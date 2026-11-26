import { test } from "@playwright/test";
import {
  BASE,
  check,
  closeDb,
  loginAdmin,
  seedDemo,
  sql,
  uniq,
  uniqPhone,
} from "./support";

// Alta, edición, búsqueda y filtros de pacientes; invitación; bloquear y desbloquear; celular sin email; dar de alta.
test.afterAll(closeDb);

test("pacientes: alta, invitación, búsqueda y desactivación", async ({
  browser,
}) => {
  seedDemo();
  const u = uniq();
  const name = `Marta ${u}`;
  const email = `paciente${u}@example.com`;
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const a = await ctx.newPage();
  await loginAdmin(a);
  await a.waitForURL("**/admin");
  await a.goto(`${BASE}/admin/pacientes`);
  check(
    "la lista incluye a Lucía Fernández",
    (await a.content()).includes("Lucía Fernández"),
  );
  await a.click("text=Agregar paciente");
  await a.waitForURL("**/nuevo");
  // email inválido: error y conserva lo escrito
  await a.fill("#name", name);
  await a.fill("#email", "no-es-email");
  await a.fill("#phone", "261 555 0199");
  await a.evaluate(
    () =>
      ((document.querySelector("#email") as HTMLInputElement).type = "text"),
  );
  await a.click("button[type=submit]");
  await a.waitForFunction(() =>
    document.querySelector("[role=alert]")?.textContent?.includes("email"),
  );
  await a.waitForFunction(
    (n) => (document.querySelector("#name") as HTMLInputElement).value === n,
    name,
  );
  check("email inválido: error y conserva los datos", true);
  await a.fill("#email", "demo1@example.com");
  await a.click("button[type=submit]");
  await a.waitForFunction(() =>
    document.querySelector("[role=alert]")?.textContent?.includes("Ya existe"),
  );
  check("email duplicado rechazado", true);
  await a.evaluate(
    () =>
      ((document.querySelector("#email") as HTMLInputElement).type = "email"),
  );
  await a.fill("#email", email);
  await a.click("button[type=submit]");
  await a.waitForSelector("text=Paciente creado");
  const inv = await a.inputValue("input[aria-label='Link de invitación']");
  const invUrl = (s: string) => s.replace(/^https?:\/\/[^/]+/, BASE);
  check("muestra el link de invitación", inv.includes("/invitacion/"));
  const wa =
    (await a.getAttribute("a:has-text('Abrir WhatsApp')", "href")) ?? "";
  check(
    "WhatsApp manual con número y mensaje",
    wa.startsWith("https://wa.me/5492615550199?text=") && wa.includes("Marta"),
  );
  await a.click("text=Copiar link");
  await a.waitForSelector("text=¡Copiado!");
  check(
    "copiar el link",
    (await a.evaluate(() => navigator.clipboard.readText())) === inv,
  );
  await a.click("text=Ver perfil");
  await a.waitForURL(/\/admin\/pacientes\/[0-9a-f-]{36}$/);
  const pid = a.url().split("/").pop();
  check(
    "el perfil muestra invitación pendiente",
    (await a.content()).includes("Invitación pendiente"),
  );
  await a.fill("#name", `${name} Gómez`);
  await a.click("text=Guardar cambios");
  await a.waitForSelector("text=Datos guardados.");
  check("editar los datos", true);
  await a.goto(`${BASE}/admin/pacientes?q=${encodeURIComponent(`marta ${u}`)}`);
  let html = await a.content();
  check(
    "búsqueda por nombre",
    html.includes(`${name} Gómez`) && !html.includes("Lucía"),
  );
  await a.goto(`${BASE}/admin/pacientes?estado=invitados`);
  html = await a.content();
  check(
    "filtro de invitados",
    html.includes(`${name} Gómez`) && !html.includes("Lucía Fernández"),
  );
  await a.goto(`${BASE}/admin/pacientes?q=%25`);
  check(
    "buscar con % no devuelve todo",
    (await a.content()).includes("No hay pacientes"),
  );
  await a.goto(`${BASE}/admin/pacientes/no-es-un-uuid`);
  html = await a.content();
  check(
    "un id inválido da 404",
    html.includes("404") || html.toLowerCase().includes("could not be found"),
  );

  // la paciente acepta la invitación
  const pc = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const pt = await pc.newPage();
  await pt.goto(invUrl(inv));
  await pt.fill("#password", "clave-paciente-123");
  await pt.fill("#confirm", "clave-paciente-123");
  await pt.click("button[type=submit]");
  await pt.waitForURL("**/paciente");
  check(
    "la paciente crea su contraseña desde el link",
    (await pt.content()).includes("Hola, Marta"),
  );
  await pt.goto(`${BASE}/admin/pacientes`);
  await pt.waitForURL("**/paciente");
  check(
    "la paciente no entra a /admin/pacientes",
    pt.url().endsWith("/paciente"),
  );
  await a.goto(`${BASE}/admin/pacientes/${pid}`);
  check("el estado pasa a En tratamiento", (await a.content()).includes("En tratamiento"));

  // desactivar cierra su sesión
  a.once("dialog", (d) => d.accept());
  await a.click("button:has-text('Bloquear acceso')");
  await a.waitForSelector("text=Acceso bloqueado");
  await pt.goto(`${BASE}/paciente`);
  await pt.waitForURL("**/login");
  check("desactivar cierra su sesión", true);
  await pt.fill("#email", email);
  await pt.fill("#password", "clave-paciente-123");
  await pt.click("button[type=submit]");
  await pt.waitForFunction(() =>
    document
      .querySelector("[role=alert]")
      ?.textContent?.includes("incorrectos"),
  );
  check("una paciente bloqueada no puede ingresar", true);
  await a.goto(`${BASE}/admin/pacientes?estado=bloqueados`);
  check("aparece en bloqueados", (await a.content()).includes(`${name} Gómez`));

  // reactivar y generar un link nuevo (olvidó la contraseña)
  await a.goto(`${BASE}/admin/pacientes/${pid}`);
  await a.click("button:has-text('Desbloquear acceso')");
  await a.waitForSelector("text=Acceso desbloqueado");
  await a.reload();
  await a.click("text=Generar link para nueva contraseña");
  await a.waitForSelector("input[aria-label='Link de invitación']");
  const inv2 = await a.inputValue("input[aria-label='Link de invitación']");
  check("el link nuevo es distinto", inv2 !== inv);
  await pt.goto(invUrl(inv2));
  await pt.fill("#password", "otra-clave-nueva-1");
  await pt.fill("#confirm", "otra-clave-nueva-1");
  await pt.click("button[type=submit]");
  await pt.waitForURL("**/paciente");
  check("restablece la contraseña con el link nuevo", true);
  check(
    "la base tiene al paciente activo",
    (await sql(`select active from users where email='${email}'`)) === "t",
  );
  await ctx.close();
  await pc.close();
});

test("pacientes: celular obligatorio, sin email, ingreso con celular y alta", async ({ browser }) => {
  seedDemo();
  const u = uniq();
  const name = `Elena ${u}`;
  const phone = uniqPhone();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctx.newPage();
  await loginAdmin(a);
  await a.waitForURL("**/admin");
  await a.goto(`${BASE}/admin/pacientes/nuevo`);

  // sin celular no se puede crear (el campo es obligatorio)
  await a.fill("#name", name);
  const phoneRequired = await a.evaluate(() => (document.querySelector("#phone") as HTMLInputElement).required);
  const emailRequired = await a.evaluate(() => (document.querySelector("#email") as HTMLInputElement).required);
  check("el celular es obligatorio y el email opcional", phoneRequired && !emailRequired);
  // un celular sin código de área se rechaza
  await a.fill("#phone", "12345");
  await a.click("button[type=submit]");
  await a.waitForFunction(() => document.querySelector("[role=alert]")?.textContent?.includes("código de área"));
  check("celular incompleto rechazado", true);
  // celular repetido (Lucía Fernández ya lo tiene, escrito de otra forma)
  await a.fill("#phone", "+54 9 261 555-0101");
  await a.click("button[type=submit]");
  await a.waitForFunction(() => document.querySelector("[role=alert]")?.textContent?.includes("celular"));
  check("celular repetido rechazado aunque esté escrito distinto", true);

  // sin email
  await a.fill("#phone", phone);
  await a.click("button[type=submit]");
  await a.waitForSelector("text=Paciente creado");
  check("se crea sin email", (await sql(`select email is null from users where name='${name}'`)) === "t");
  const inv = await a.inputValue("input[aria-label='Link de invitación']");
  const invUrl = inv.replace(/^https?:\/\/[^/]+/, BASE);
  const wa = (await a.getAttribute("a:has-text('Abrir WhatsApp')", "href")) ?? "";
  check("la invitación sale por WhatsApp", wa.startsWith("https://wa.me/549261"));

  // busca por celular (con otro formato)
  await a.goto(`${BASE}/admin/pacientes?q=${encodeURIComponent(phone.replace(/ /g, "-"))}`);
  check("búsqueda por celular", (await a.content()).includes(name));

  // la paciente crea su contraseña y entra con el celular
  const pc = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pt = await pc.newPage();
  await pt.goto(invUrl);
  await pt.fill("#password", "clave-paciente-123");
  await pt.fill("#confirm", "clave-paciente-123");
  await pt.click("button[type=submit]");
  await pt.waitForURL("**/paciente");
  await pt.context().clearCookies();
  await pt.goto(`${BASE}/login`);
  await pt.fill("#email", `0${phone.replace(/^261/, "261 15")}`.replace(/^0261 15 /, "0261 15 "));
  await pt.fill("#password", "clave-paciente-123");
  await pt.click("button[type=submit]");
  await pt.waitForURL("**/paciente");
  check("ingresa con el celular (escrito con 0 y 15)", true);

  // dar de alta: conserva la cuenta, sale del desplegable de turnos
  await a.goto(`${BASE}/admin/pacientes?q=${encodeURIComponent(name)}`);
  await a.click(`text=${name}`);
  await a.waitForURL(/\/admin\/pacientes\/[0-9a-f-]{36}$/);
  const pid = a.url().split("/").pop();
  a.once("dialog", (d) => d.accept());
  await a.click("button:has-text('Dar de alta')");
  await a.waitForSelector("text=Paciente dado de alta");
  check("queda dado de alta", (await sql(`select discharged_at is not null from users where id='${pid}'`)) === "t");
  await a.goto(`${BASE}/admin/pacientes?estado=alta`);
  check("aparece en «Dados de alta»", (await a.content()).includes(name));
  await a.goto(`${BASE}/admin/agenda/cita/nueva`);
  check("ya no se le agenda turno", !(await a.content()).includes(name));
  await pt.context().clearCookies();
  await pt.goto(`${BASE}/login`);
  await pt.fill("#email", phone);
  await pt.fill("#password", "clave-paciente-123");
  await pt.click("button[type=submit]");
  await pt.waitForURL("**/paciente");
  check("sigue pudiendo ingresar (conserva la cuenta)", true);

  // reabrir el tratamiento
  await a.goto(`${BASE}/admin/pacientes/${pid}`);
  await a.click("button:has-text('Reabrir tratamiento')");
  await a.waitForSelector("text=Tratamiento reabierto");
  check("reabre el tratamiento", (await sql(`select discharged_at is null from users where id='${pid}'`)) === "t");
  await ctx.close();
  await pc.close();
});
