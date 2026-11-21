import { test } from "@playwright/test";
import { BASE, check, closeDb, loginAdmin, sql, uniq } from "./support";

// Invitación → contraseña → ingreso, permisos básicos, cookies y cabeceras de seguridad.
test.afterAll(closeDb);

test("autenticación e invitaciones", async ({ browser }) => {
  const u = uniq();
  const email = `lucia.auth${u}@example.com`;
  const adminCtx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const a = await adminCtx.newPage();
  await loginAdmin(a);
  await a.waitForURL("**/admin");
  check(
    "login admin ok",
    (await a.content()).includes("Ana Pérez") &&
      (await a.locator("h1").first().innerText()).includes("Agenda"),
  );
  // Ana da de alta a la paciente y copia su link de invitación
  await a.goto(`${BASE}/admin/pacientes/nuevo`);
  await a.fill("#name", "Lucía Auth");
  await a.fill("#email", email);
  await a.click("button[type=submit]");
  await a.waitForSelector("text=Paciente creado");
  const inv = await a.inputValue("input[aria-label='Link de invitación']");
  const invUrl = inv.replace(/^https?:\/\/[^/]+/, BASE);

  const alertHas = (pg: typeof a, txt: string) =>
    pg.waitForFunction(
      (t) => document.querySelector("[role=alert]")?.textContent?.includes(t),
      txt,
      { timeout: 8000 },
    );

  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await c.newPage();
  await pg.goto(invUrl);
  check(
    "la invitación muestra el saludo",
    (await pg.content()).includes("Hola, Lucía"),
  );
  await pg.fill("#password", "corta");
  await pg.fill("#confirm", "corta");
  await pg.click("button[type=submit]");
  await alertHas(pg, "al menos 10");
  check("rechaza una contraseña corta", true);
  await pg.fill("#password", "una-clave-larga-1");
  await pg.fill("#confirm", "otra-distinta-123");
  await pg.click("button[type=submit]");
  await alertHas(pg, "no coinciden");
  check("rechaza contraseñas que no coinciden", true);
  await pg.fill("#password", "una-clave-larga-1");
  await pg.fill("#confirm", "una-clave-larga-1");
  await pg.click("button[type=submit]");
  await pg.waitForURL("**/paciente");
  check(
    "entra a /paciente al crear la contraseña",
    (await pg.content()).includes("Hola, Lucía"),
  );
  await pg.goto(`${BASE}/admin`);
  await pg.waitForURL("**/paciente");
  check("el paciente no accede a /admin", pg.url().endsWith("/paciente"));
  await pg.goto(invUrl);
  check(
    "una invitación usada queda inválida",
    (await pg.content()).includes("no válida"),
  );
  await pg.goto(`${BASE}/paciente`);
  await pg.getByRole("button", { name: "Cerrar sesión" }).first().click();
  await pg.waitForURL("**/login");
  await pg.goto(`${BASE}/paciente`);
  await pg.waitForURL("**/login");
  check("sin sesión redirige al login", true);
  await pg.goto(`${BASE}/login`);
  await pg.fill("#email", email);
  await pg.fill("#password", "mala");
  await pg.click("button[type=submit]");
  await alertHas(pg, "incorrectos");
  check("un login incorrecto muestra el error", true);
  await pg.waitForFunction(
    (e) => (document.querySelector("#email") as HTMLInputElement).value === e,
    email,
    { timeout: 5000 },
  );
  check("conserva el email tras el error", true);
  await pg.fill("#email", "nadie@example.com");
  await pg.fill("#password", "mala");
  await pg.click("button[type=submit]");
  await pg.waitForFunction(
    () =>
      (document.querySelector("#email") as HTMLInputElement).value ===
        "nadie@example.com" &&
      !(document.querySelector("#password") as HTMLInputElement).value,
    undefined,
    { timeout: 5000 },
  );
  await alertHas(pg, "incorrectos");
  check("un email inexistente da el mismo mensaje", true);
  await pg.fill("#email", email);
  await pg.fill("#password", "una-clave-larga-1");
  await pg.click("button[type=submit]");
  await pg.waitForURL("**/paciente");
  check("el login de la paciente funciona", true);
  await c.close();

  await a.goto(`${BASE}/paciente`);
  await a.waitForURL("**/admin");
  check("Ana no accede a /paciente", a.url().endsWith("/admin"));
  const cookie = (await adminCtx.cookies()).find((x) => x.name === "session");
  check(
    "cookie de sesión httpOnly + lax",
    cookie?.httpOnly && cookie.sameSite === "Lax",
  );
  let r = await a.request.get(`${BASE}/manifest.webmanifest`);
  check(
    "el manifest de la app está",
    r.ok() && (await r.text()).includes("standalone"),
  );
  r = await a.request.get(`${BASE}/sw.js`);
  check("el service worker está", r.ok());
  r = await a.request.get(`${BASE}/login`);
  check(
    "cabeceras de seguridad (X-Frame-Options)",
    r.headers()["x-frame-options"] === "DENY",
  );
  check(
    "el paciente quedó activo en la base",
    (await sql(`select active from users where email='${email}'`)) === "t",
  );
  await adminCtx.close();
});
