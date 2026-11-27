import path from "node:path";
import { test } from "@playwright/test";
import { BASE, check, closeDb, DEMO_PASSWORD, login, loginAdmin, seedDemo, sql, uniq, waitFor } from "./support";

// Biblioteca: Ana carga libros con portada, marca préstamos; Ana y pacientes comentan y se responden.
test.afterAll(closeDb);

const FOTO = path.join(process.cwd(), "e2e", "fixtures", "foto.png");

test("biblioteca: libros, portada, préstamo y comentarios", async ({ browser }) => {
  seedDemo();
  await sql("delete from library_comments; delete from library_books");
  const u = uniq();
  const t1 = `Libro Uno ${u}`;
  const t2 = `Libro Dos ${u}`;

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await ctx.newPage();
  await loginAdmin(a);
  await a.waitForURL("**/admin");
  await a.goto(`${BASE}/admin/biblioteca`);
  check("biblioteca vacía", (await a.innerText("main")).includes("Todavía no hay libros"));

  const addBook = async (title: string, author: string) => {
    await a.goto(`${BASE}/admin/biblioteca/nuevo`);
    await a.fill("input[name=title]", title);
    await a.fill("input[name=author]", author);
    return a;
  };

  // sin portada no se guarda
  await addBook(t1, "Autora Uno");
  await a.click("form button[type=submit]:has-text('Guardar libro')");
  await a.waitForSelector("[role=alert]:not(#__next-route-announcer__)");
  check("sin portada no se puede guardar", (await a.innerText("[role=alert]:not(#__next-route-announcer__)")).includes("portada"));
  // un archivo que no es foto se rechaza
  await a.setInputFiles("#coverFile", { name: "libro.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await a.waitForSelector("text=tiene que ser una foto");
  check("un PDF no sirve de portada", true);
  // con foto
  await a.setInputFiles("#coverFile", FOTO);
  await a.waitForSelector("text=Foto lista.");
  await a.click("form button[type=submit]:has-text('Guardar libro')");
  await a.waitForURL(/\/admin\/biblioteca\/[0-9a-f-]{36}$/);
  const id1 = a.url().split("/").pop()!;
  check("el libro se guarda con su portada", (await sql(`select title from library_books where id='${id1}'`)) === t1);
  const cover = a.locator("header img").first();
  check(
    "la portada se ve",
    await waitFor(async () => (await cover.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)) === true),
  );
  check("arranca disponible", (await a.innerText("header")).includes("Disponible"));

  await addBook(t2, "Autor Dos");
  await a.setInputFiles("#coverFile", FOTO);
  await a.waitForSelector("text=Foto lista.");
  await a.click("form button[type=submit]:has-text('Guardar libro')");
  await a.waitForURL(/\/admin\/biblioteca\/[0-9a-f-]{36}$/);
  const id2 = a.url().split("/").pop()!;

  // prestar el primero
  await a.goto(`${BASE}/admin/biblioteca/${id1}`);
  await a.click("button:has-text('Marcar como prestado')");
  check("marcar prestado", await waitFor(async () => (await sql(`select lent_at is not null from library_books where id='${id1}'`)) === "t"));
  check("el botón pasa a «Marcar como disponible»", await waitFor(async () => (await a.locator("button:has-text('Marcar como disponible')").count()) === 1));
  await a.goto(`${BASE}/admin/biblioteca`);
  const grid = await a.innerText("main");
  check("la lista muestra uno prestado y otro disponible", grid.includes("Prestado") && grid.includes("Disponible") && grid.includes("2 libros · 1 disponible"));

  // paciente: ve la biblioteca y comenta
  const pc = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p1 = await pc.newPage();
  await login(p1, "demo1@example.com", DEMO_PASSWORD);
  await p1.waitForURL("**/paciente");
  await p1.goto(`${BASE}/paciente/biblioteca`);
  const pt = await p1.innerText("main");
  check("la paciente ve los dos libros con su estado", pt.includes(t1) && pt.includes(t2) && pt.includes("Prestado") && pt.includes("Disponible"));
  await p1.goto(`${BASE}/paciente/biblioteca?q=${encodeURIComponent("autor dos")}`);
  const filtered = await p1.innerText("main");
  check("buscar por autor filtra", filtered.includes(t2) && !filtered.includes(t1));
  await p1.goto(`${BASE}/paciente/biblioteca/${id1}`);
  check("la paciente no ve botones de administración", (await p1.locator("button:has-text('Marcar como')").count()) === 0 && (await p1.locator("text=Eliminar libro").count()) === 0);
  await p1.fill("textarea[name=body]", "Me encantó este libro");
  await p1.click("button:has-text('Publicar comentario')");
  check("la paciente comenta", await waitFor(async () => (await sql(`select count(*) from library_comments where book_id='${id1}' and body='Me encantó este libro'`)) === "1"));

  // Ana lo ve como nuevo y responde
  const html = await (await a.goto(`${BASE}/admin/biblioteca/${id1}`))!.text();
  check("Ana ve el comentario como Nuevo con el nombre completo", html.includes("Me encantó este libro") && html.includes(">Nuevo<") && html.includes("Lucía Fernández"));
  await a.waitForTimeout(1500);
  await a.locator("[aria-label^='Respuestas a'] button:text-is('Responder')").first().click();
  await a.fill("[aria-label^='Respuestas a'] textarea", "¡Gracias, Lucía! Lo tengo prestado.");
  await a.click("[aria-label^='Respuestas a'] button[type=submit]");
  check("Ana responde", await waitFor(async () => (await sql(`select count(*) from library_comments where book_id='${id1}' and parent_id is not null`)) === "1"));
  check("lo que escribe Ana no queda como nuevo", (await sql(`select count(*) from library_comments c join users u on u.id=c.user_id where u.role='admin' and c.admin_seen_at is null`)) === "0");

  // otro paciente ve la charla (solo el nombre de pila) y también responde
  const pc2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await pc2.newPage();
  await login(p2, "demo2@example.com", DEMO_PASSWORD);
  await p2.waitForURL("**/paciente");
  await p2.goto(`${BASE}/paciente/biblioteca/${id1}`);
  const t = await p2.innerText("main");
  check("otro paciente ve el comentario y la respuesta de Ana", t.includes("Me encantó este libro") && t.includes("Lo tengo prestado"));
  check("otro paciente ve solo el nombre de pila", t.includes("Lucía") && !t.includes("Fernández"));
  await p2.locator("[aria-label^='Respuestas a'] button:text-is('Responder')").first().click();
  await p2.fill("[aria-label^='Respuestas a'] textarea", "¡Yo también quiero leerlo!");
  await p2.click("[aria-label^='Respuestas a'] button[type=submit]");
  check("otro paciente puede responder en un comentario ajeno", await waitFor(async () => (await sql(`select count(*) from library_comments where body='¡Yo también quiero leerlo!' and parent_id is not null`)) === "1"));

  // Ana oculta el comentario de Lucía: los pacientes dejan de verlo (y sus respuestas)
  await a.goto(`${BASE}/admin/biblioteca/${id1}`);
  await a.locator("[data-comment]", { hasText: "Me encantó este libro" }).locator("button:text-is('Ocultar')").click();
  check("Ana oculta el comentario", await waitFor(async () => (await sql(`select count(*) from library_comments where hidden_at is not null`)) === "1"));
  await p2.reload();
  check("los pacientes ya no ven el comentario oculto", !(await p2.innerText("main")).includes("Me encantó este libro"));

  // un paciente borra su propio comentario
  await p1.goto(`${BASE}/paciente/biblioteca/${id1}`);
  await p1.fill("textarea[name=body]", "Comentario para borrar");
  await p1.click("button:has-text('Publicar comentario')");
  check("se publica el comentario", await waitFor(async () => (await sql(`select count(*) from library_comments where body='Comentario para borrar'`)) === "1"));
  p1.once("dialog", (d) => d.accept());
  await p1.locator("[data-comment]", { hasText: "Comentario para borrar" }).locator("button:text-is('Borrar')").click();
  check("quien comenta puede borrar lo propio", await waitFor(async () => (await sql(`select count(*) from library_comments where body='Comentario para borrar'`)) === "0"));
  check("y no puede borrar lo de otros", (await p2.locator("button:text-is('Borrar')").count()) === 0);

  // los pacientes no entran al panel de Ana
  await p1.goto(`${BASE}/admin/biblioteca`);
  await p1.waitForURL("**/paciente**");
  check("la paciente no entra a /admin/biblioteca", !p1.url().includes("/admin"));

  // editar y eliminar
  await a.goto(`${BASE}/admin/biblioteca/${id2}`);
  await a.click("summary:has-text('Editar libro')");
  await a.fill("details input[name=title]", `${t2} (2ª ed.)`);
  await a.click("details button:has-text('Guardar cambios')");
  check("editar el título", await waitFor(async () => (await sql(`select title from library_books where id='${id2}'`)) === `${t2} (2ª ed.)`));
  a.once("dialog", (d) => d.accept());
  await a.click("button:has-text('Eliminar libro')");
  await a.waitForURL("**/admin/biblioteca");
  check("eliminar el libro", await waitFor(async () => (await sql(`select count(*) from library_books where id='${id2}'`)) === "0"));
  await ctx.close();
  await pc.close();
  await pc2.close();
});
