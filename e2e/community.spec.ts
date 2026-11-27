import { test } from "@playwright/test";
import { BASE, check, closeDb, DEMO_PASSWORD, login, loginAdmin, seedDemo, sql, uniq } from "./support";

// Privacidad (nombre de usuario y secciones opcionales) y Comunidad moderada por Ana.
test.afterAll(closeDb);

test("privacidad y comunidad", async ({ browser }) => {
  seedDemo();
  await sql("delete from community_posts");
  const u = uniq();
  const title = `Feria de emprendedores ${u}`;

  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await ctxA.newPage();
  await loginAdmin(a);
  await a.waitForURL("**/admin");

  const ctxP = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctxP.newPage();
  await login(p, "demo1@example.com", DEMO_PASSWORD);
  await p.waitForURL("**/paciente**");

  // ---------- Nombre de usuario
  await p.goto(`${BASE}/paciente/perfil?seccion=privacidad`);
  await p.fill("input[name=alias]", "Lucía");
  await p.click("form:has(input[name=alias]) button[type=submit]");
  await p.waitForSelector("[role=alert]:not(#__next-route-announcer__)");
  check("no se acepta el nombre real como usuario", (await p.innerText("[role=alert]:not(#__next-route-announcer__)")).length > 0);
  await p.fill("input[name=alias]", "Cedro");
  await p.click("form:has(input[name=alias]) button[type=submit]");
  await p.waitForSelector("text=Ese nombre de usuario ya lo usa");
  check("el nombre de usuario no se repite", true);
  await p.fill("input[name=alias]", `Luna ${u}`);
  await p.click("form:has(input[name=alias]) button[type=submit]");
  await p.waitForSelector("text=Nombre de usuario guardado");
  check("se guarda el nombre de usuario", (await sql("select alias from users where email='demo1@example.com'")) === `Luna ${u}`);

  // ---------- Proponer algo
  await p.goto(`${BASE}/paciente/comunidad/nueva`);
  await p.fill("#title", title);
  await p.fill("#description", "Este sábado en la plaza, desde las 10.");
  await p.fill("input[name=link]", "javascript:alert(1)");
  await p.click("form:has(#title) button[type=submit]");
  await p.waitForSelector("[role=alert]:not(#__next-route-announcer__)");
  check("un enlace peligroso se rechaza", (await sql(`select count(*) from community_posts where title='${title}'`)) === "0");
  await p.fill("input[name=link]", "https://www.ejemplo.com/feria");
  await p.click("form:has(#title) button[type=submit]");
  await p.waitForURL(/enviada=1/);
  check("queda pendiente", (await sql(`select status from community_posts where title='${title}'`)) === "pending");

  const p2ctx = await browser.newContext();
  const p2 = await p2ctx.newPage();
  await login(p2, "demo2@example.com", DEMO_PASSWORD);
  await p2.waitForURL("**/paciente**");
  await p2.goto(`${BASE}/paciente/comunidad`);
  check("otro paciente no ve lo pendiente", !(await p2.innerText("main")).includes(title));

  // ---------- Ana pide cambios
  await a.goto(`${BASE}/admin/comunidad`);
  check("Ana ve el nombre real y el usuario", (await a.innerText("main")).includes("Lucía Fernández") && (await a.innerText("main")).includes(`Luna ${u}`));
  await a.fill("textarea[name=note]", "Falta aclarar el horario.");
  await a.click("button:has-text('Enviar pedido de cambios')");
  await a.waitForSelector("text=No hay publicaciones esperando revisión");
  check("queda con cambios pedidos", (await sql(`select status from community_posts where title='${title}'`)) === "changes");
  await p.goto(`${BASE}/paciente/comunidad`);
  check("el paciente ve la nota de Ana", (await p.innerText("main")).includes("Falta aclarar el horario."));

  // ---------- el paciente corrige y reenvía
  await p.click("a:has-text('Corregir y reenviar')");
  await p.fill("#description", "Este sábado en la plaza, desde las 10 hasta las 18.");
  await p.click("form:has(#title) button[type=submit]");
  await p.waitForURL(/enviada=1/);
  check("vuelve a pendiente", (await sql(`select status from community_posts where title='${title}'`)) === "pending");

  // ---------- Ana aprueba
  await a.goto(`${BASE}/admin/comunidad`);
  await a.click("button:has-text('Aprobar y publicar')");
  await a.waitForSelector("text=No hay publicaciones esperando revisión");
  check("aprobada con vencimiento a un mes", (await sql(`select status='approved' and expires_at > now() + interval '27 days' and expires_at < now() + interval '32 days' from community_posts where title='${title}'`)) === "t");
  await p2.goto(`${BASE}/paciente/comunidad`);
  const main = await p2.innerText("main");
  check("otro paciente la ve con el usuario, sin nombre real", main.includes(title) && main.includes(`Luna ${u}`) && !main.includes("Lucía") && !main.includes("Fernández"));
  check("el enlace abre afuera y sin referrer", (await p2.locator(`a[href='https://www.ejemplo.com/feria'][target=_blank][rel*=noopener]`).count()) === 1);

  // ---------- vencida: deja de verse
  await sql(`update community_posts set expires_at = now() - interval '1 day' where title='${title}'`);
  await p2.goto(`${BASE}/paciente/comunidad`);
  check("al vencer deja de verse", !(await p2.innerText("main")).includes(title));
  await a.goto(`${BASE}/admin/comunidad?tab=vencidas`);
  check("Ana la ve en vencidas", (await a.innerText("main")).includes(title));
  await a.click("button:has-text('Volver a publicar un mes')");
  await a.waitForSelector("text=No hay publicaciones vencidas");
  await p2.goto(`${BASE}/paciente/comunidad`);
  check("al renovarla vuelve a verse", (await p2.innerText("main")).includes(title));

  // ---------- Ana publica
  await a.goto(`${BASE}/admin/comunidad/nueva`);
  await a.fill("#title", `Aviso del consultorio ${u}`);
  await a.fill("#description", "El consultorio cierra el feriado.");
  await a.click("form:has(#title) button[type=submit]");
  await a.waitForURL(/tab=publicadas/);
  await p2.goto(`${BASE}/paciente/comunidad`);
  check("lo de Ana sale publicado", (await p2.innerText("main")).includes(`Aviso del consultorio ${u}`));

  // ---------- sin usuario no se participa
  await sql("update users set alias = null, alias_key = null where email='demo2@example.com'");
  await p2.goto(`${BASE}/paciente/comunidad/nueva`);
  check("sin nombre de usuario se pide elegirlo", (await p2.innerText("main")).includes("Privacidad"));

  // ---------- apagar una sección
  await p.goto(`${BASE}/paciente/perfil?seccion=privacidad`);
  await p.uncheck("input[name=useCommunity]");
  await p.click("form:has(input[name=useCommunity]) button[type=submit]");
  await p.waitForSelector("text=Preferencias guardadas");
  check("la sección apagada no aparece en el menú", (await p.locator("nav a[href='/paciente/comunidad']").count()) === 0);
  await p.goto(`${BASE}/paciente/comunidad`);
  check("y redirige al inicio", new URL(p.url()).pathname === "/paciente");
  await sql("update users set use_community = true where email='demo1@example.com'");
});
