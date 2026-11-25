import { test } from "@playwright/test";
import {
  addDays,
  BASE,
  check,
  closeDb,
  futureMonday,
  loginAdmin,
  seedDemo,
  sql,
  uniq,
  uniqPhone,
} from "./support";

// Notas privadas: solo las ve Ana, nunca la paciente.
test.afterAll(closeDb);

test("notas privadas del paciente", async ({ browser }) => {
  seedDemo();
  const u = uniq();
  const name = `Nora Notas ${u}`;
  const email = `nora${u}@example.com`;
  const secret = `Secreto-${u}: tema sensible`;
  const day = addDays(futureMonday(14), 10 * 7 + 3); // un jueves lejano: nadie más usa ese día
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const a = await ctx.newPage();
  await loginAdmin(a);
  await a.waitForURL("**/admin");
  await a.goto(`${BASE}/admin/pacientes/nuevo`);
  await a.fill("#name", name);
  await a.fill("#phone", uniqPhone());
  await a.fill("#email", email);
  await a.click("button[type=submit]");
  await a.waitForSelector("text=Paciente creado");
  const inv = (
    await a.inputValue("input[aria-label='Link de invitación']")
  ).replace(/^https?:\/\/[^/]+/, BASE);
  await a.click("text=Ver perfil");
  await a.waitForURL(/\/admin\/pacientes\/[0-9a-f-]{36}$/);
  await a.waitForSelector("section[aria-label='Notas privadas']");
  const pid = a.url().split("/").pop();
  const html = await a.content();
  check(
    "sin notas al inicio",
    html.includes("Todavía no hay notas.") && html.includes("Solo vos"),
  );
  await a.fill("#body", "   ");
  await a.click("button:has-text('Guardar nota')");
  check(
    "una nota vacía no se guarda",
    (await sql(
      `select count(*) from patient_notes where patient_id='${pid}'`,
    )) === "0",
  );
  await a.fill("#body", secret);
  await a.click("button:has-text('Guardar nota')");
  await a.waitForSelector("text=Nota guardada.");
  await a.reload();
  check("la nota aparece en el perfil", (await a.content()).includes(secret));
  await a.fill("#body", "Segunda nota\ncon salto de línea");
  await a.click("button:has-text('Guardar nota')");
  await a.waitForSelector("text=Nota guardada.");
  await a.reload();
  let txt = await a.innerText("section[aria-label='Notas privadas']");
  check(
    "la más nueva va primero",
    txt.indexOf("Segunda nota") < txt.indexOf(secret),
  );

  // nota escrita desde una cita del calendario
  const hh = String(8 + (Number(u) % 10)).padStart(2, "0");
  const mm = String((Math.floor(Number(u) / 10) % 12) * 5).padStart(2, "0");
  await a.goto(`${BASE}/admin/agenda/cita/nueva?fecha=${day}`);
  await a.selectOption("#patientId", { label: name });
  await a.fill("#date", day);
  await a.fill("#start", `${hh}:${mm}`);
  await a.fill("#note", "Nota desde la cita");
  await a.click("button[type=submit]");
  await a.waitForURL(`**/admin?fecha=${day}`);
  await a.goto(`${BASE}/admin/pacientes/${pid}`);
  txt = await a.innerText("section[aria-label='Notas privadas']");
  check(
    "la nota de la cita aparece marcada «del calendario»",
    txt.includes("Nota desde la cita") && txt.includes("del calendario"),
  );
  a.once("dialog", (d) => d.accept());
  await a
    .locator("article:has-text('Segunda nota') button:has-text('Borrar')")
    .click();
  await a.waitForSelector("article:has-text('Segunda nota')", {
    state: "detached",
  });
  check(
    "borrar una nota",
    (await sql(
      `select count(*) from patient_notes where patient_id='${pid}'`,
    )) === "1",
  );
  check(
    "las notas del calendario no tienen botón borrar",
    (await a
      .locator(
        "article:has-text('Nota desde la cita') button:has-text('Borrar')",
      )
      .count()) === 0,
  );

  // cita cancelada: su nota deja de listarse
  await a.goto(`${BASE}/admin?vista=dia&fecha=${day}`);
  await a.locator("a[href^='/admin/agenda/']:visible").first().click();
  a.once("dialog", (d) => d.accept());
  await a.click("button:has-text('Cancelar cita')");
  await a.waitForURL("**/admin?fecha=*");
  await a.goto(`${BASE}/admin/pacientes/${pid}`);
  check(
    "la nota de una cita cancelada no aparece",
    !(await a.content()).includes("Nota desde la cita"),
  );

  // privacidad: la paciente nunca ve las notas
  const pc = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const pt = await pc.newPage();
  await pt.goto(inv);
  await pt.fill("#password", "clave-paciente-123");
  await pt.fill("#confirm", "clave-paciente-123");
  await pt.click("button[type=submit]");
  await pt.waitForURL("**/paciente");
  let leak = false;
  for (const path of [
    "/paciente",
    "/paciente/turnos",
    "/paciente/foro",
    "/paciente/perfil",
  ]) {
    await pt.goto(BASE + path);
    leak = leak || (await pt.content()).includes(secret);
  }
  check("la paciente no ve las notas en ninguna pantalla", !leak);
  await pt.goto(`${BASE}/admin/pacientes/${pid}`);
  await pt.waitForURL("**/paciente");
  check(
    "la paciente no abre el perfil con notas",
    !(await pt.content()).includes(secret),
  );
  const anon = await browser.newContext();
  const np = await anon.newPage();
  await np.goto(`${BASE}/admin/pacientes/${pid}`);
  await np.waitForURL("**/login");
  check("sin sesión redirige al login", true);
  await ctx.close();
  await pc.close();
  await anon.close();
});
