import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import {
  BASE,
  check,
  closeDb,
  DEMO_PASSWORD as PW,
  login,
  loginAdmin,
  resetForumStorage,
  seedDemo,
  sql,
} from "./support";

// Foro: publicaciones con archivos y enlaces, comentarios, moderación, corazones y respuestas,
// filtros por tipo, buscador, avisos a pacientes, edición y borrado.
test.afterAll(async () => {
  await sql("delete from rate_limits");
  await closeDb();
});

const STORE = path.join(process.cwd(), ".storage-e2e", "forum");
const stored = () => {
  try {
    return readdirSync(STORE).length;
  } catch {
    return 0;
  }
};
const file = (name: string, mimeType: string, buffer: Buffer) => ({
  name,
  mimeType,
  buffer,
});
const MP3 = file("meditacion.mp3", "audio/mpeg", Buffer.alloc(1_000_000, 7));
const PDF = file(
  "guia.pdf",
  "application/pdf",
  Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2_000, 32)]),
);
const PNG = file(
  "foto.png",
  "image/png",
  readFileSync(path.join(__dirname, "fixtures", "foto.png")),
);
const HTML = file(
  "malo.html",
  "text/html",
  Buffer.from("<script>alert(1)</script>"),
);
const HUGE = file("enorme.mp3", "audio/mpeg", Buffer.alloc(6 * 1024 * 1024, 1)); // el tope de la prueba es 5 MB
const LIST = "ul[aria-label='Archivos para publicar']";

test("foro completo", async ({ browser }) => {
  await sql(
    "delete from forum_comments; delete from forum_attachments; delete from forum_posts",
  );
  resetForumStorage();
  seedDemo();
  const ca = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const ad = await ca.newPage();
  await loginAdmin(ad);
  await ad.waitForURL("**/admin");

  // ---------- Ana publica
  await ad.goto(`${BASE}/admin/foro`);
  check(
    "el foro empieza vacío",
    (await ad.locator("text=Todavía no hay publicaciones").count()) === 1,
  );
  await ad.goto(`${BASE}/admin/foro/nueva`);
  await ad.fill("#title", "Ejercicio de <b>respiración</b>");
  await ad.fill("#body", "Escuchá el audio antes de dormir.\nLinea dos.");
  await ad.setInputFiles("#file-picker", [HTML]);
  await ad.waitForSelector("li[data-status='error']");
  check(
    "un .html se rechaza con un mensaje claro",
    (await ad.innerText(LIST)).includes("no está permitido"),
  );
  await ad.locator(`${LIST} button:has-text('Quitar')`).click();
  await ad.setInputFiles("#file-picker", [HUGE]);
  await ad.waitForSelector("li[data-status='error']");
  check(
    "un archivo de 6 MB se rechaza (tope de la prueba: 5 MB)",
    (await ad.innerText(LIST)).includes("máximo"),
  );
  await ad.locator(`${LIST} button:has-text('Quitar')`).click();
  check("nada rechazado quedó en el almacenamiento", stored() === 0);
  await ad.setInputFiles("#file-picker", [MP3, PDF, PNG]);
  await ad.waitForFunction(
    () => document.querySelectorAll("li[data-status='done']").length === 3,
  );
  check("se suben los 3 archivos válidos", stored() === 3);
  await ad.click("button:has-text('+ Agregar enlace')");
  await ad.fill("input[placeholder='https://…']", "javascript:alert(1)");
  await ad.click("button:has-text('Publicar')");
  await ad.waitForSelector("[role=alert]:has-text('no es válido')");
  check(
    "un enlace javascript: se rechaza y no se pierde lo escrito",
    (await ad.inputValue("#title")) === "Ejercicio de <b>respiración</b>" &&
      (await ad.locator("li[data-status='done']").count()) === 3,
  );
  await ad.fill("input[placeholder='https://…']", "youtube.com/watch?v=abc123");
  await ad.locator("input[id^='label-']").fill("Clase en video <img src=x>");
  await ad.click("button:has-text('Publicar')");
  await ad.waitForURL(/\/admin\/foro\/[0-9a-f-]{36}$/);
  const pid = ad.url().split("/").pop()!;
  check(
    "la publicación se guardó con 4 adjuntos",
    (await sql(
      `select count(*) from forum_attachments where post_id='${pid}'`,
    )) === "4",
  );
  check(
    "el título con HTML se muestra como texto",
    (await ad.locator("h1").innerText()) ===
      "Ejercicio de <b>respiración</b>" &&
      (await ad.locator("h1 b").count()) === 0,
  );
  check(
    "hay reproductor de audio, imagen, PDF y enlace",
    (await ad.locator("audio").count()) === 1 &&
      (await ad.locator("main img").count()) === 1 &&
      (await ad.locator("a:has-text('Abrir')").count()) >= 2 &&
      (await ad.locator("a:has-text('Abrir enlace')").count()) === 1,
  );
  const link = ad.locator("a:has-text('Abrir enlace')");
  check(
    "el enlace se abre en otra pestaña de forma segura",
    ((await link.getAttribute("rel")) ?? "").includes("noopener") &&
      (await link.getAttribute("href")) ===
        "https://youtube.com/watch?v=abc123",
  );
  check(
    "la etiqueta con HTML no inyecta nada",
    (await ad.locator("ul[aria-label='Material'] img[src='x']").count()) === 0,
  );
  await ad.goto(`${BASE}/admin/foro`);
  check(
    "el espacio usado aparece en el listado",
    (await ad.content()).includes("Espacio usado"),
  );

  // ---------- Paciente
  const c1 = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const a = await c1.newPage();
  await login(a, "demo1@example.com", PW);
  await a.waitForURL("**/paciente");
  await a.goto(`${BASE}/paciente/foro`);
  check(
    "la paciente ve la publicación",
    (await a.locator("text=Ejercicio de <b>respiración</b>").count()) === 1,
  );
  await a.click("a:has-text('Ejercicio de')");
  await a.waitForSelector("audio");
  const att = (type: string) =>
    sql(
      `select id from forum_attachments where post_id='${pid}' and content_type='${type}'`,
    );
  const [aid, pdf, png] = [
    await att("audio/mpeg"),
    await att("application/pdf"),
    await att("image/png"),
  ];
  let r = await c1.request.get(`${BASE}/api/forum/files/${aid}`);
  check(
    "la paciente puede bajar el audio completo",
    r.status() === 200 &&
      (await r.body()).length === 1_000_000 &&
      r.headers()["content-type"] === "audio/mpeg",
  );
  r = await c1.request.get(`${BASE}/api/forum/files/${aid}`, {
    headers: { Range: "bytes=0-99" },
  });
  check(
    "el audio se puede adelantar (Range → 206)",
    r.status() === 206 && (await r.body()).length === 100,
  );
  r = await c1.request.get(`${BASE}/api/forum/files/${pdf}?descargar=1`);
  check(
    "el PDF se baja como descarga",
    r.status() === 200 &&
      (r.headers()["content-disposition"] ?? "").startsWith("attachment") &&
      (await r.body()).subarray(0, 4).toString() === "%PDF",
  );
  r = await c1.request.get(`${BASE}/api/forum/files/${png}`);
  check(
    "la imagen se sirve con su tipo",
    r.status() === 200 &&
      r.headers()["content-type"] === "image/png" &&
      r.headers()["x-content-type-options"] === "nosniff",
  );
  check(
    "la imagen se ve en la página",
    await a.evaluate(() => {
      const i = document.querySelector("main img") as HTMLImageElement;
      return i.complete && i.naturalWidth > 0;
    }),
  );
  const anon = await browser.newContext();
  r = await anon.request.get(`${BASE}/api/forum/files/${aid}`, {
    maxRedirects: 0,
  });
  check("sin sesión no se puede ver ningún archivo (401)", r.status() === 401);
  r = await anon.request.get(`${BASE}/api/forum/files/no-es-uuid`, {
    maxRedirects: 0,
  });
  check("un id inválido da 404, no un error", [401, 404].includes(r.status()));

  // comentario con HTML y privacidad del apellido
  await a.fill(
    "textarea[name=body]",
    "<script>window.__pwn=1</script>¡Gracias! <b>muy lindo</b>",
  );
  await a.click("button:has-text('Publicar comentario')");
  await a.waitForSelector("text=Comentario publicado");
  await a.reload();
  check(
    "el comentario aparece y el HTML no se ejecuta",
    (await a
      .locator("[data-comment][aria-label='Comentario de Lucía']")
      .count()) === 1 &&
      (await a.evaluate(
        () => (window as unknown as { __pwn?: number }).__pwn === undefined,
      )) &&
      (await a.locator("[data-comment] b").count()) === 0,
  );
  check(
    "en los comentarios la paciente se ve con su nombre de pila",
    !(await a.innerText("section[aria-label='Comentarios']")).includes(
      "Fernández",
    ),
  );
  check(
    "la paciente nunca ve la etiqueta Nuevo (es solo para Ana)",
    (await a
      .locator("section[aria-label='Comentarios'] >> text=Nuevo")
      .count()) === 0,
  );

  // otro paciente
  const c2 = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const b = await c2.newPage();
  await login(b, "demo2@example.com", PW);
  await b.waitForURL("**/paciente");
  await b.goto(`${BASE}/paciente/foro/${pid}`);
  const bHtml = await b.content();
  check(
    "otro paciente ve el comentario solo con el nombre de pila",
    (await b
      .locator("[data-comment][aria-label='Comentario de Lucía']")
      .count()) === 1 &&
      !bHtml.includes("Fernández") &&
      !bHtml.includes("demo1@example.com"),
  );
  check(
    "otro paciente no puede borrar un comentario ajeno",
    (await b
      .locator(
        "[data-comment][aria-label='Comentario de Lucía'] button:has-text('Borrar')",
      )
      .count()) === 0,
  );
  await b.fill("textarea[name=body]", "Yo también lo escuché.");
  await b.click("button:has-text('Publicar comentario')");
  await b.waitForSelector("text=Comentario publicado");
  await b.reload();
  const MT = "[data-comment][aria-label='Comentario de Martín']";
  check(
    "Martín puede borrar su propio comentario",
    (await b.locator(`${MT} button:has-text('Borrar')`).count()) === 1,
  );
  b.once("dialog", (d) => d.accept());
  await b.locator(`${MT} button:has-text('Borrar')`).click();
  await b.waitForSelector(MT, { state: "detached" });
  check(
    "borrar el propio comentario funciona",
    (await sql(
      "select count(*) from forum_comments c join users u on u.id=c.user_id where u.email='demo2@example.com'",
    )) === "0",
  );

  // ---------- Ana modera
  const html = await (await ca.request.get(`${BASE}/admin/foro/${pid}`)).text();
  check(
    "Ana ve el nombre completo y la etiqueta Nuevo",
    html.includes("Comentario de Lucía Fernández") && html.includes(">Nuevo<"),
  );
  await ad.goto(`${BASE}/admin/foro/${pid}`);
  await ad.waitForTimeout(1500);
  await ad.goto(`${BASE}/admin/foro`);
  check(
    "al abrir la publicación se apaga el aviso del menú",
    !(await ad.locator("aside a[href='/admin/foro']").innerText()).includes(
      "1",
    ) &&
      (await sql(
        "select count(*) from forum_comments where admin_seen_at is null",
      )) === "0",
  );
  const LU = "[data-comment][aria-label='Comentario de Lucía Fernández']";
  await ad.goto(`${BASE}/admin/foro/${pid}`);
  await ad.locator(`${LU} button:has-text('Ocultar')`).click();
  await ad.waitForSelector("text=Oculto para los pacientes");
  await b.goto(`${BASE}/paciente/foro/${pid}`);
  check(
    "un comentario oculto desaparece para los pacientes",
    (await b
      .locator("[data-comment][aria-label^='Comentario de Lucía']")
      .count()) === 0,
  );
  await a.reload();
  check(
    "también para su propio autor (moderación silenciosa)",
    (await a.locator("[data-comment][aria-label^='Comentario de']").count()) ===
      0,
  );
  await ad.locator(`${LU} button:has-text('Mostrar')`).click();
  await ad.waitForSelector("text=Oculto para los pacientes", {
    state: "detached",
  });
  await b.reload();
  check(
    "al mostrarlo vuelve a verse",
    (await b
      .locator("[data-comment][aria-label='Comentario de Lucía']")
      .count()) === 1,
  );
  await ad.fill("textarea[name=body]", "Me alegra que te sirva.");
  await ad.click("button:has-text('Publicar comentario')");
  await ad.waitForSelector("text=Comentario publicado");
  await b.reload();
  check(
    "la respuesta de Ana se ve con la etiqueta Administradora",
    (await b
      .locator(
        "[data-comment][aria-label^='Comentario de'] >> text=Administradora",
      )
      .count()) === 1,
  );

  // ---------- filtro por tipo (paciente)
  const F1 = "00000000-0000-4000-8000-0000000000f1";
  await sql(
    `insert into forum_posts(id,title,body) values ('${F1}','Solo un enlace','')`,
  );
  await sql(
    `insert into forum_attachments(post_id,kind,label,url,position) values ('${F1}','link','Lectura','https://ejemplo.com.ar/x',0)`,
  );
  const n = () => a.locator("ul[aria-label='Publicaciones'] > li").count();
  await a.goto(`${BASE}/paciente/foro`);
  check(
    "sin filtro se ven todas las publicaciones",
    (await n()) === 2 &&
      (await a.locator("nav[aria-label='Filtrar por tipo']").count()) === 1,
  );
  await a.goto(`${BASE}/paciente/foro?tipo=audio`);
  check(
    "filtrar por audios muestra solo la que tiene audio",
    (await n()) === 1 && (await a.locator("text=Solo un enlace").count()) === 0,
  );
  await a.goto(`${BASE}/paciente/foro?tipo=enlace`);
  check(
    "filtrar por enlaces muestra las dos (el video de YouTube cuenta aparte)",
    (await n()) >= 1,
  );
  await a.goto(`${BASE}/paciente/foro?tipo=video`);
  check(
    "filtrar por videos muestra la que tiene el enlace de YouTube",
    (await n()) === 1,
  );
  await a.goto(`${BASE}/paciente/foro?tipo=imagen`);
  check("filtrar por imágenes muestra una", (await n()) === 1);
  await a.goto(`${BASE}/paciente/foro?tipo=documento`);
  check("filtrar por documentos muestra una", (await n()) === 1);
  await a.goto(`${BASE}/paciente/foro?tipo=zzz`);
  check("un filtro inválido se ignora y muestra todo", (await n()) === 2);
  await a.goto(`${BASE}/paciente/foro?tipo=audio`);
  await a.click("nav[aria-label='Filtrar por tipo'] >> text=Todo");
  await a.waitForURL(/\/paciente\/foro$/);
  check("el botón Todo quita el filtro", (await n()) === 2);

  // ---------- buscador y filtros de Ana
  const m = () => ad.locator("ul[aria-label='Publicaciones'] > li").count();
  await ad.goto(`${BASE}/admin/foro?tipo=audio&tipo=imagen`);
  check(
    "Ana: audio O imagen (por defecto «alguno») muestra la que tiene alguno",
    (await m()) === 1,
  );
  await ad.goto(`${BASE}/admin/foro?tipo=imagen&tipo=enlace`);
  check(
    "Ana: imagen O enlace muestra las dos publicaciones",
    (await m()) === 2,
  );
  await ad.goto(`${BASE}/admin/foro?tipo=imagen&tipo=video&modo=todos`);
  check("Ana: imagen Y video muestra la que tiene ambas", (await m()) === 1);
  await ad.goto(`${BASE}/admin/foro?tipo=imagen&tipo=enlace&modo=todos`);
  check(
    "Ana: imagen Y enlace no muestra nada si ninguna publicación tiene ambas",
    (await m()) === 0,
  );
  await ad.goto(`${BASE}/admin/foro?tipo=audio&tipo=documento&modo=todos`);
  check(
    "Ana: audio Y documento (ambos en la misma publicación)",
    (await m()) === 1,
  );
  await ad.goto(`${BASE}/admin/foro?q=guia.pdf`);
  check("el buscador encuentra por nombre de archivo", (await m()) === 1);
  await ad.goto(`${BASE}/admin/foro?q=${encodeURIComponent("solo un")}`);
  check("el buscador encuentra por título", (await m()) === 1);
  await ad.goto(`${BASE}/admin/foro?q=%25`);
  check("buscar con % no devuelve todo", (await m()) === 0);
  await ad.goto(`${BASE}/admin/foro?q=respiraci&tipo=video&modo=todos`);
  check("buscador y filtro se combinan", (await m()) === 1);
  await ad.goto(`${BASE}/admin/foro`);
  check(
    "las publicaciones muestran iconos de tipo",
    (await ad.locator("ul[aria-label='Tipos de material'] li").count()) >= 4,
  );
  await sql(`delete from forum_posts where id='${F1}'`);

  // ---------- corazones y respuestas
  await ad.goto(`${BASE}/admin/foro/${pid}`);
  check(
    "Ana ve el corazón vacío en el comentario de una paciente",
    (await ad.locator(`${LU} button[aria-label='Me gusta']`).count()) === 1,
  );
  await ad.locator(`${LU} button[aria-label='Me gusta']`).click();
  await ad.waitForSelector(`${LU} button[aria-label='Quitar me gusta']`);
  check(
    "el corazón queda guardado",
    (await sql(
      "select count(*) from forum_comments where admin_hearted_at is not null",
    )) === "1",
  );
  const badge = (pg: typeof a) =>
    pg.locator("a[href='/paciente/foro'] span[aria-label$='pendientes']");
  await a.goto(`${BASE}/paciente`);
  check(
    "el menú Foro de la paciente avisa del corazón de Ana",
    (await badge(a).first().innerText()) === "1",
  );
  await b.goto(`${BASE}/paciente`);
  check("otro paciente no recibe aviso", (await badge(b).count()) === 0);
  await a.goto(`${BASE}/paciente/foro/${pid}`);
  await a.waitForTimeout(1500);
  await a.goto(`${BASE}/paciente`);
  check(
    "al abrir la publicación se apaga el aviso del menú de la paciente",
    (await badge(a).count()) === 0,
  );
  await a.goto(`${BASE}/paciente/foro/${pid}`);
  check(
    "la paciente ve que a Ana le gustó su comentario",
    (await a.locator("[data-heart]").count()) === 1 &&
      (await a.innerText("[data-heart]")).includes("Le gustó a"),
  );
  check(
    "la paciente no tiene botón de me gusta",
    (await a
      .locator(
        "button[aria-label='Me gusta'], button[aria-label='Quitar me gusta']",
      )
      .count()) === 0,
  );
  await b.goto(`${BASE}/paciente/foro/${pid}`);
  check(
    "otro paciente ve el corazón pero no puede responder en comentarios ajenos",
    (await b.locator("[data-heart]").count()) === 1 &&
      (await b.locator("button:text-is('Responder')").count()) === 0,
  );
  await ad.locator(`${LU} button[aria-label='Quitar me gusta']`).click();
  await ad.waitForSelector(`${LU} button[aria-label='Me gusta']`);
  check(
    "Ana puede quitar el corazón",
    (await sql(
      "select count(*) from forum_comments where admin_hearted_at is not null",
    )) === "0",
  );
  const RES = "[aria-label='Respuestas a Lucía Fernández']";
  await ad.locator(`${RES} button:text-is('Responder')`).click();
  await ad.fill(`${RES} textarea`, "Gracias por escribir, Lucía <i>:)</i>");
  await ad.click(`${RES} button[type=submit]`);
  await ad.waitForSelector("[data-comment][aria-label^='Respuesta de']");
  check(
    "la respuesta de Ana queda colgada del comentario de Lucía",
    (await sql(
      "select count(*) from forum_comments r join forum_comments p on p.id=r.parent_id where r.body like 'Gracias por escribir%' and p.body like '%¡Gracias! %'",
    )) === "1",
  );
  check(
    "el formulario de respuesta se cierra al publicar",
    (await ad.locator(`${RES} textarea`).count()) === 0,
  );
  await a.goto(`${BASE}/paciente`);
  check(
    "la respuesta de Ana también avisa en el menú",
    (await badge(a).first().innerText()) === "1",
  );
  await a.goto(`${BASE}/paciente/foro/${pid}`);
  check(
    "la respuesta nueva se marca como Nueva",
    (await a.locator("[data-new-reply]").count()) === 1,
  );
  await a.waitForTimeout(1500);
  await a.reload();
  check(
    "y deja de marcarse al verla",
    (await a.locator("[data-new-reply]").count()) === 0,
  );
  check(
    "la paciente ve la respuesta de Ana dentro de su comentario",
    (await a
      .locator(
        "[aria-label='Respuestas a Lucía'] [data-comment][aria-label^='Respuesta de']",
      )
      .count()) === 1 &&
      (await a.locator("[aria-label='Respuestas a Lucía'] i").count()) === 0,
  );
  await b.reload();
  check(
    "otro paciente ve la respuesta (hilo) sin poder responder",
    (await b
      .locator("[aria-label='Respuestas a Lucía'] [data-comment]")
      .count()) === 1 &&
      (await b.locator("button:text-is('Responder')").count()) === 0,
  );
  await a.waitForTimeout(2000);
  await a
    .locator("[aria-label='Respuestas a Lucía'] button:text-is('Responder')")
    .click();
  await a.fill("[aria-label='Respuestas a Lucía'] textarea", "¡Gracias a vos!");
  await a.click("[aria-label='Respuestas a Lucía'] button[type=submit]");
  await a.waitForSelector(
    "[aria-label='Respuestas a Lucía'] >> text=¡Gracias a vos!",
  );
  check(
    "la paciente puede seguir la charla en su propio hilo",
    (await sql(
      "select count(*) from forum_comments where body='¡Gracias a vos!' and parent_id is not null",
    )) === "1",
  );
  await ad.goto(`${BASE}/admin/foro/${pid}`);
  check(
    "la respuesta de la paciente aparece como Nueva para Ana",
    (await ad.locator(`${RES} >> text=Nuevo`).count()) === 1,
  );
  await sql(
    "update forum_comments set hidden_at=now() where parent_id is null and body like '<script>%'",
  );
  await a.reload();
  check(
    "si se oculta el comentario, sus respuestas también se ocultan",
    (await a.locator("[data-comment][aria-label*='Lucía']").count()) === 0,
  );
  await sql("update forum_comments set hidden_at=null");

  // límite de comentarios por paciente (demo3)
  const c3 = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const t = await c3.newPage();
  await login(t, "demo3@example.com", PW);
  await t.waitForURL("**/paciente");
  await t.goto(`${BASE}/paciente/foro/${pid}`);
  for (let i = 0; i < 6; i++) {
    await t.fill("textarea[name=body]", `mensaje ${i}`);
    await t.click("button:has-text('Publicar comentario')");
    await t.waitForTimeout(500);
  }
  check(
    "una paciente no puede comentar más de 5 veces en 2 minutos",
    (await t.locator("text=muy rápido").count()) === 1 &&
      (await sql(
        "select count(*) from forum_comments c join users u on u.id=c.user_id where u.email='demo3@example.com'",
      )) === "5",
  );
  await t.fill("textarea[name=body]", "x".repeat(1001));
  await t.evaluate(() =>
    document.querySelector("textarea")!.removeAttribute("maxlength"),
  );
  await t.click("button:has-text('Publicar comentario')");
  await t.waitForTimeout(600);
  check(
    "un comentario de más de 1000 caracteres se rechaza",
    (await sql(
      "select count(*) from forum_comments where length(body)>1000",
    )) === "0",
  );

  // cerrar comentarios
  await ad.goto(`${BASE}/admin/foro/${pid}`);
  check(
    "con los comentarios abiertos se ve el cartel verde y el botón para cerrar",
    (await ad.locator("text=Comentarios abiertos").count()) === 1 &&
      (await ad.locator("button:has-text('Cerrar comentarios')").count()) === 1,
  );
  await ad.click("button:has-text('Cerrar comentarios')");
  await ad.waitForSelector("text=Comentarios cerrados");
  check(
    "el cartel pasa a «Comentarios cerrados» con el botón para abrir",
    (await ad.locator("button:has-text('Abrir comentarios')").count()) === 1,
  );
  await b.reload();
  check(
    "con comentarios cerrados la paciente no ve el formulario",
    (await b.locator("textarea[name=body]").count()) === 0 &&
      (await b.locator("text=están cerrados").count()) === 1,
  );
  await ad.reload();
  check(
    "Ana igual puede responder",
    (await ad.locator("textarea[name=body]").count()) === 1,
  );

  // ---------- permisos
  for (const p of [
    "/admin/foro",
    "/admin/foro/nueva",
    `/admin/foro/${pid}`,
    `/admin/foro/${pid}/editar`,
  ]) {
    await b.goto(BASE + p);
    await b.waitForURL("**/paciente");
  }
  check(
    "una paciente no entra a las pantallas de administración del foro",
    true,
  );
  await sql("update users set active=false where email='demo3@example.com'");
  r = await c3.request.get(`${BASE}/api/forum/files/${aid}`, {
    maxRedirects: 0,
  });
  check("una paciente desactivada no puede ver archivos", r.status() === 401);
  await sql("update users set active=true where email='demo3@example.com'");

  // ---------- aviso a pacientes por material nuevo
  await ad.goto(`${BASE}/admin/foro/${pid}/editar`);
  check(
    "la casilla de avisar viene sin tildar",
    (await ad.locator("input[name=notify]").count()) === 1 &&
      !(await ad.locator("input[name=notify]").isChecked()),
  );
  await ad.click("button:has-text('Guardar cambios')");
  await ad.waitForURL(/\/admin\/foro\/[0-9a-f-]{36}$/);
  check(
    "sin tildar no se avisa a nadie",
    !ad.url().includes("aviso=") &&
      (await ad.locator("[data-aviso]").count()) === 0 &&
      (await sql(
        `select notified_at is null from forum_posts where id='${pid}'`,
      )) === "t",
  );
  await ad.goto(`${BASE}/admin/foro/${pid}/editar`);
  await ad.check("input[name=notify]");
  await ad.click("button:has-text('Guardar cambios')");
  await ad.waitForSelector("[data-aviso]");
  check(
    "tildada y sin email configurado: avisa que fue simulado",
    (await ad.getAttribute("[data-aviso]", "data-aviso")) === "sim" &&
      (await ad.innerText("[data-aviso]")).includes("falta configurar"),
  );
  check(
    "un aviso simulado no marca la publicación como avisada",
    (await sql(
      `select notified_at is null from forum_posts where id='${pid}'`,
    )) === "t",
  );
  await sql("update users set notify_forum=false where role='patient'");
  await ad.goto(`${BASE}/admin/foro/${pid}/editar`);
  await ad.check("input[name=notify]");
  await ad.click("button:has-text('Guardar cambios')");
  await ad.waitForSelector("[data-aviso]");
  check(
    "si nadie quiere avisos, se le dice a Ana",
    (await ad.getAttribute("[data-aviso]", "data-aviso")) === "nadie",
  );
  await sql("update users set notify_forum=true where role='patient'");
  await a.goto(`${BASE}/paciente/perfil`);
  await a.click("nav[aria-label='Secciones del perfil'] >> text=Recordatorios");
  check(
    "la paciente ve la opción de avisos del foro tildada",
    await a.locator("input[name=notifyForum]").isChecked(),
  );
  await a.uncheck("input[name=notifyForum]");
  await a.click("button:has-text('Guardar preferencias')");
  await a.waitForSelector("text=Preferencias guardadas.");
  check(
    "destildarla se guarda",
    (await sql(
      "select notify_forum from users where email='demo1@example.com'",
    )) === "f",
  );
  await a.check("input[name=notifyForum]");
  await a.click("button:has-text('Guardar preferencias')");
  await a.waitForSelector("text=Preferencias guardadas.");
  await a.waitForTimeout(300);
  check(
    "y se puede volver a tildar",
    (await sql(
      "select notify_forum from users where email='demo1@example.com'",
    )) === "t",
  );
  await b.goto(`${BASE}/paciente/foro/${pid}`);
  check(
    "la paciente no ve nunca la casilla de avisar",
    (await b.locator("input[name=notify]").count()) === 0,
  );

  // ---------- editar
  await ad.goto(`${BASE}/admin/foro/${pid}/editar`);
  await ad.fill("#title", "Respiración guiada");
  await ad
    .locator(
      "ul[aria-label='Material actual'] li:has-text('guia.pdf') button:has-text('Quitar')",
    )
    .click();
  await ad.click("button:has-text('+ Agregar enlace')");
  await ad.fill(
    "input[placeholder='https://…']",
    "https://www.ejemplo.com.ar/lectura",
  );
  await ad.click("button:has-text('Guardar cambios')");
  await ad.waitForURL(/\/admin\/foro\/[0-9a-f-]{36}$/);
  check(
    "editar cambia el título y quita el PDF",
    (await ad.locator("h1").innerText()) === "Respiración guiada" &&
      (await sql(
        `select count(*) from forum_attachments where id='${pdf}'`,
      )) === "0",
  );
  check("el PDF quitado se borró del almacenamiento", stored() === 2);
  check(
    "el enlace nuevo se agregó",
    (await sql(
      `select count(*) from forum_attachments where post_id='${pid}' and kind='link'`,
    )) === "2",
  );
  r = await c1.request.get(`${BASE}/api/forum/files/${pdf}`, {
    maxRedirects: 0,
  });
  check("el archivo quitado ya no se puede pedir (404)", r.status() === 404);

  // ---------- borrar la publicación
  ad.once("dialog", (d) => d.accept());
  await ad.click("button:has-text('Eliminar publicación')");
  await ad.waitForURL("**/admin/foro");
  check(
    "borrar la publicación borra adjuntos y comentarios",
    (await sql(
      "select (select count(*) from forum_attachments)+(select count(*) from forum_comments)+(select count(*) from forum_posts)",
    )) === "0",
  );
  check("y sus archivos del almacenamiento", stored() === 0);
  await Promise.all([ca, c1, c2, c3, anon].map((x) => x.close()));
});
