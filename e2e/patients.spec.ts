import { test } from "@playwright/test";
import {
  BASE,
  check,
  closeDb,
  loginAdmin,
  seedDemo,
  sql,
  uniq,
} from "./support";

// Alta, edición, búsqueda y filtros de pacientes; invitación; desactivar y reactivar.
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
  check("el estado pasa a Activo", (await a.content()).includes("Activo"));

  // desactivar cierra su sesión
  a.once("dialog", (d) => d.accept());
  await a.click("button:has-text('Desactivar paciente')");
  await a.waitForSelector("text=Paciente desactivado");
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
  check("una paciente inactiva no puede ingresar", true);
  await a.goto(`${BASE}/admin/pacientes?estado=inactivos`);
  check("aparece en inactivos", (await a.content()).includes(`${name} Gómez`));

  // reactivar y generar un link nuevo (olvidó la contraseña)
  await a.goto(`${BASE}/admin/pacientes/${pid}`);
  await a.click("button:has-text('Reactivar paciente')");
  await a.waitForSelector("text=Paciente reactivado");
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
