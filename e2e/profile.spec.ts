import { test } from "@playwright/test";
import {
  BASE,
  check,
  closeDb,
  DEMO_PASSWORD,
  login,
  loginAdmin,
  seedDemo,
  sql,
  waitFor,
} from "./support";

// Perfil de la paciente: celular, preferencias de recordatorios, cambio de contraseña y límite de intentos.
test.afterAll(async () => {
  await sql("delete from rate_limits");
  await closeDb();
});

const NEW = "clave-nueva-456789";

test("perfil de la paciente", async ({ browser }) => {
  seedDemo();
  await sql("delete from rate_limits");
  const m2 = "demo2@example.com";
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await c.newPage();
  const sub = (pg: typeof a, label: string, sect: string) =>
    pg
      .locator(`section[aria-label='${sect}'] button:has-text('${label}')`)
      .click();
  await login(a, m2, DEMO_PASSWORD);
  await a.waitForURL("**/paciente");
  await a.goto(`${BASE}/paciente/perfil`);
  const html = await a.content();
  check(
    "muestra nombre y email",
    html.includes("Martín Giménez") && html.includes(m2),
  );
  check(
    "nombre y email no son editables",
    (await a.locator("input[name=name], input[name=email]").count()) === 0,
  );

  // teléfono
  await a.fill("#phone", "abc");
  await sub(a, "Guardar celular", "Mis datos");
  await a.waitForSelector("text=solo puede tener números");
  check(
    "teléfono inválido rechazado",
    (await sql(`select phone from users where email='${m2}'`)) ===
      "261 555 0102",
  );
  await a.fill("#phone", "+54 261 600-1234");
  await sub(a, "Guardar celular", "Mis datos");
  await a.waitForSelector("text=Celular guardado.");
  check(
    "teléfono guardado",
    await waitFor(
      async () =>
        (await sql(`select phone from users where email='${m2}'`)) ===
        "+54 261 600-1234",
    ),
  );
  // el celular es obligatorio: no se puede dejar vacío
  await a.fill("#phone", "");
  await a.evaluate(() => ((document.querySelector("#phone") as HTMLInputElement).required = false));
  await sub(a, "Guardar celular", "Mis datos");
  await a.waitForFunction(() => document.querySelector("[role=alert]")?.textContent?.includes("celular"));
  check(
    "un celular vacío se rechaza y no se borra",
    (await sql(`select phone from users where email='${m2}'`)) === "+54 261 600-1234",
  );
  check(
    "no tocó el teléfono de otro paciente",
    (await sql("select phone from users where email='demo1@example.com'")) ===
      "261 555 0101",
  );

  // recordatorios
  await a.click("nav[aria-label='Secciones del perfil'] >> text=Recordatorios");
  await a.waitForSelector("section[aria-label='Recordatorios de turnos']");
  check(
    "por defecto todo activado",
    (await sql(
      `select remind_email and remind_push and remind_24h and remind_2h from users where email='${m2}'`,
    )) === "t",
  );
  await a.uncheck("input[name=remindEmail]");
  await a.uncheck("input[name=remind2h]");
  await sub(a, "Guardar preferencias", "Recordatorios de turnos");
  await a.waitForSelector("text=Preferencias guardadas.");
  check(
    "preferencias guardadas",
    (await sql(
      `select remind_email,remind_push,remind_24h,remind_2h from users where email='${m2}'`,
    )) === "f|t|t|f",
  );
  await a.reload();
  check(
    "al volver se ven las preferencias",
    !(await a.isChecked("input[name=remindEmail]")) &&
      (await a.isChecked("input[name=remindPush]")) &&
      (await a.isChecked("input[name=remind24h]")) &&
      !(await a.isChecked("input[name=remind2h]")),
  );

  // contraseña
  await a.click("nav[aria-label='Secciones del perfil'] >> text=Contraseña");
  await a.waitForSelector("section[aria-label='Contraseña']");
  const c2 = await browser.newContext();
  const o = await c2.newPage();
  await login(o, m2, DEMO_PASSWORD);
  await o.waitForURL("**/paciente");
  const pw = async (cur: string, nw: string, conf: string) => {
    await a.fill("#current", cur);
    await a.fill("#password", nw);
    await a.fill("#confirm", conf);
    await sub(a, "Cambiar contraseña", "Contraseña");
  };
  await pw("incorrecta-123", NEW, NEW);
  await a.waitForSelector("text=actual no es correcta");
  check("la contraseña actual incorrecta se rechaza", true);
  await pw(DEMO_PASSWORD, NEW, "otra-distinta-99");
  await a.waitForSelector("text=no coinciden");
  check("una confirmación distinta se rechaza", true);
  await a.evaluate(() =>
    document
      .querySelectorAll("input[type=password]")
      .forEach((i) => i.removeAttribute("required")),
  );
  await pw(DEMO_PASSWORD, "corta", "corta");
  await a.waitForSelector("text=al menos 10");
  check("una contraseña corta se rechaza", true);
  await pw(DEMO_PASSWORD, DEMO_PASSWORD, DEMO_PASSWORD);
  await a.waitForSelector("text=distinta de la actual");
  check("la misma contraseña se rechaza", true);
  const h0 = await sql(`select password_hash from users where email='${m2}'`);
  await pw(DEMO_PASSWORD, NEW, NEW);
  await a.waitForSelector("text=Contraseña actualizada");
  check(
    "el hash cambió",
    (await sql(`select password_hash from users where email='${m2}'`)) !== h0,
  );
  await a.reload();
  check(
    "la sesión actual sigue abierta",
    (await a.innerText("h1")).includes("Perfil"),
  );
  await o.goto(`${BASE}/paciente`);
  await o.waitForURL("**/login");
  check("la sesión del otro dispositivo se cerró", true);
  const n = await browser.newContext();
  const nn = await n.newPage();
  await login(nn, m2, DEMO_PASSWORD);
  await nn.waitForSelector("[role=alert]");
  check("la clave vieja ya no entra", nn.url().includes("/login"));
  await login(nn, m2, NEW);
  await nn.waitForURL("**/paciente");
  check("la clave nueva entra", true);

  // límite de intentos (demo3)
  const c3 = await browser.newContext();
  const t = await c3.newPage();
  await login(t, "demo3@example.com", DEMO_PASSWORD);
  await t.waitForURL("**/paciente");
  await t.goto(`${BASE}/paciente/perfil?seccion=contrasena`);
  for (let i = 0; i < 10; i++) {
    await t.fill("#current", `mala-${i}-xxxxxx`);
    await t.fill("#password", NEW);
    await t.fill("#confirm", NEW);
    await t
      .locator("section[aria-label='Contraseña'] button:has-text('Cambiar')")
      .click();
    await t.waitForTimeout(700);
  }
  check(
    "tras varios intentos fallidos se bloquea",
    (await t.locator("text=Demasiados intentos").count()) === 1,
  );

  // Ana no entra al perfil de paciente
  const ca = await browser.newContext();
  const ad = await ca.newPage();
  await loginAdmin(ad);
  await ad.waitForURL("**/admin");
  await ad.goto(`${BASE}/paciente/perfil`);
  await ad.waitForURL("**/admin");
  check("Ana no accede al perfil de paciente", true);
  await Promise.all([c, c2, n, c3, ca].map((x) => x.close()));
});
