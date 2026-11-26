import { test } from "@playwright/test";
import {
  addDays,
  clearEvents,
  BASE,
  check,
  closeDb,
  DEMO_PASSWORD,
  futureMonday,
  login,
  loginAdmin,
  seedDemo,
  sql,
  uniq,
  uniqPhone,
  pickPatient,
} from "./support";

// Agenda: citas, repetición semanal, superposiciones, otros eventos, edición y cancelación.
test.afterAll(closeDb);

test("agenda de Ana", async ({ browser }) => {
  seedDemo();
  await clearEvents();
  const u = uniq();
  const n1 = `Paula Agenda ${u}`;
  const n2 = `Rosa Inactiva ${u}`;
  const mon = futureMonday(14); // lunes de la semana 1; todo lo demás se calcula desde acá
  const tue = addDays(mon, 1);
  const sat = addDays(mon, 5);
  const mon2 = addDays(mon, 7);
  const c = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const a = await c.newPage();
  await loginAdmin(a);
  await a.waitForURL("**/admin");
  const blocks = (pg: typeof a) =>
    pg.locator("a[href^='/admin/agenda/']:not([href*='/cita/']):not([href*='/evento/']):visible").count();
  const submitError = (text: string) =>
    a.waitForFunction(
      (t) => document.querySelector("[role=alert]")?.textContent?.includes(t),
      text,
      { timeout: 8000 },
    );
  const newPatient = async (name: string, email: string) => {
    await a.goto(`${BASE}/admin/pacientes/nuevo`);
    await a.fill("#name", name);
    await a.fill("#phone", uniqPhone());
    await a.fill("#email", email);
    await a.click("button[type=submit]");
    await a.waitForSelector("text=Paciente creado");
    await a.click("text=Ver perfil");
    await a.waitForURL("**/admin/pacientes/*");
  };
  await newPatient(n1, `p1${u}@example.com`);
  await newPatient(n2, `p2${u}@example.com`);
  a.once("dialog", (d) => d.accept());
  await a.click("button:has-text('Bloquear acceso')");
  await a.waitForSelector("text=Acceso bloqueado");

  const cita = async (
    date: string,
    start: string,
    dur = "50",
    repeat = "0",
    name = n1,
    note = "",
  ) => {
    await a.goto(`${BASE}/admin/agenda/cita/nueva?fecha=${date}`);
    await pickPatient(a, name);
    await a.fill("#date", date);
    await a.fill("#start", start);
    await a.selectOption("#duration", dur);
    await a.selectOption("#repeat", repeat);
    if (note) await a.fill("#note", note);
    await a.click("button[type=submit]");
  };
  const otro = async (title: string, date: string, s: string, e: string) => {
    await a.goto(`${BASE}/admin/agenda/evento/nuevo?fecha=${date}`);
    await a.fill("#title", title);
    await a.fill("#date", date);
    await a.fill("#start", s);
    await a.fill("#end", e);
    await a.click("button[type=submit]");
  };
  const count = (q: string) => sql(q);

  await a.goto(`${BASE}/admin/agenda/cita/nueva`);
  const opts = await a.locator("#patientId option").allInnerTexts();
  check(
    "el desplegable incluye activos y excluye inactivos",
    opts.some((o) => o.startsWith(n1)) && !opts.some((o) => o.startsWith(n2)),
  );
  // buscador de pacientes: filtra por nombre (sin importar tildes) y por celular
  await a.fill("#patientSearch", "lucia fernandez");
  const filtered = await a.locator("#patientId option").allInnerTexts();
  check("el buscador filtra por nombre sin importar tildes", filtered.length === 1 && filtered[0].startsWith("Lucía Fernández"));
  await a.fill("#patientSearch", "261 555 0102");
  const byPhone = await a.locator("#patientId option").allInnerTexts();
  check("el buscador filtra por celular", byPhone.length === 1 && byPhone[0].startsWith("Martín Giménez"));
  await a.fill("#patientSearch", "zzzz");
  check("sin coincidencias avisa", (await a.locator("text=Nadie coincide").count()) === 1);
  // botón directo desde el panel
  await a.goto(`${BASE}/admin`);
  await a.click("a:has-text('Agendar cita')");
  await a.waitForURL("**/admin/agenda/cita/nueva**");
  check("el panel tiene el botón directo «Agendar cita»", true);

  // cita con repetición de 4 semanas
  await cita(mon, "10:00", "50", "4", n1, "Traer el registro");
  await a.waitForURL(`**/admin?fecha=${mon}`);
  check("guardar redirige a la agenda", true);
  await a.goto(`${BASE}/admin?fecha=${mon}`);
  check(
    "semana 1: aparece la cita",
    (await blocks(a)) === 1 && (await a.content()).includes(n1),
  );
  check(
    "serie creada: 4 citas",
    (await count("select count(*) from events where kind='appointment'")) ===
      "4",
  );
  await a.goto(`${BASE}/admin?fecha=${mon2}`);
  check("semana 2: también aparece", (await blocks(a)) === 1);

  // superposición
  await cita(mon, "10:30", "30");
  await submitError("se superpone");
  check("la superposición se rechaza con un mensaje claro", true);
  check(
    "el formulario conserva lo escrito tras el error",
    (await a.inputValue("#start")) === "10:30",
  );
  await cita(mon, "10:50", "30");
  await a.waitForURL(`**/admin?fecha=${mon}`);
  check(
    "citas contiguas permitidas (10:50 tras 10:00-10:50)",
    (await count("select count(*) from events where kind='appointment'")) ===
      "5",
  );
  await cita(mon, "10:00", "50", "4");
  await submitError("No se puede repetir");
  check(
    "una serie con conflicto no se crea a medias",
    (await count("select count(*) from events")) === "5",
  );

  // fin de semana
  await cita(sat, "10:00");
  await a.waitForURL(`**/admin?fecha=${sat}`);
  check(
    "el sábado se acepta",
    (await count(`select count(*) from events where starts_at::date = '${sat}'`)) === "1",
  );
  // 24 h: un evento de madrugada y una cita a la noche, en domingo
  const sun = addDays(mon, 6);
  await otro("Madrugada", sun, "00:30", "02:00");
  await a.waitForURL(`**/admin?fecha=${sun}`);
  await cita(sun, "23:00", "50");
  await a.waitForURL(`**/admin?fecha=${sun}`);
  await a.goto(`${BASE}/admin?vista=dia&fecha=${sun}`);
  check("el domingo muestra los eventos de madrugada y de la noche", (await blocks(a)) === 2);
  await a.goto(`${BASE}/admin?fecha=${mon}`);
  check(
    "la semana muestra los 7 días",
    (await a.locator("a[href^='/admin?vista=dia&fecha=']:visible").filter({ hasText: /^(lun|mar|mi[eé]|jue|vie|s[aá]b|dom)/i }).count()) === 7,
  );
  await cita(sun, "23:30", "50");
  await submitError("el mismo día");
  check("una cita no puede cruzar la medianoche", true);

  // otros eventos
  await otro("Clase", tue, "11:00", "13:00");
  await a.waitForURL(`**/admin?fecha=${tue}`);
  await a.goto(`${BASE}/admin?vista=dia&fecha=${tue}`);
  check(
    "otro evento visible en azul",
    (await a.locator("a[href^='/admin/agenda/']:not([href*='/cita/']):not([href*='/evento/']).bg-azul:visible").count()) ===
      1,
  );
  await otro("Reunión", tue, "12:00", "14:00");
  await submitError("se superpone con «Clase»");
  check("otro evento superpuesto se rechaza", true);
  await otro("Mal", addDays(mon, 2), "13:00", "12:00");
  await submitError("posterior");
  check("un fin anterior al inicio se rechaza", true);

  // vista día
  await a.goto(`${BASE}/admin?vista=dia&fecha=${tue}`);
  check(
    "vista día: solo la clase del martes",
    (await blocks(a)) === 1 && (await a.content()).includes("Clase"),
  );
  await a.goto(`${BASE}/admin?vista=dia&fecha=${mon}`);
  check("vista día del lunes: 2 citas contiguas", (await blocks(a)) === 2);

  // editar
  await a.goto(`${BASE}/admin?vista=dia&fecha=${tue}`);
  await a.locator("a.bg-azul:visible").click();
  await a.waitForURL("**/admin/agenda/*");
  await a.fill("#title", "Clase de yoga");
  await a.click("button[type=submit]");
  await a.waitForURL(`**/admin?fecha=${tue}`);
  await a.goto(`${BASE}/admin?vista=dia&fecha=${tue}`);
  check("editar el título", (await a.content()).includes("Clase de yoga"));
  await a.locator("a.bg-azul:visible").click();
  await a.fill("#date", mon);
  await a.fill("#start", "10:30");
  await a.click("button[type=submit]");
  await submitError("se superpone");
  check("editar hacia un conflicto se rechaza", true);

  // cancelar «este y los siguientes»
  await a.goto(`${BASE}/admin?fecha=${mon2}`);
  await a.locator("a[href^='/admin/agenda/']:not([href*='/cita/']):not([href*='/evento/']):visible").first().click();
  await a.waitForURL("**/admin/agenda/*");
  check(
    "la nota privada se ve en el detalle",
    (await a.content()).includes("Traer el registro"),
  );
  await a.check("input[value=following]");
  a.once("dialog", (d) => d.accept());
  await a.click("button:has-text('Cancelar cita')");
  await a.waitForURL(`**/admin?fecha=${mon2}`);
  check(
    "cancelar «este y siguientes» deja solo la primera semana",
    (await count(
      `select count(*) from events where kind='appointment' and cancelled_at is null and starts_at::date >= '${mon2}'`,
    )) === "0",
  );
  await a.goto(`${BASE}/admin?fecha=${mon2}`);
  check("la semana cancelada queda vacía", (await blocks(a)) === 0);
  await cita(mon2, "10:00");
  await a.waitForURL(`**/admin?fecha=${mon2}`);
  check("el horario cancelado queda libre", true);

  // perfil con próximos turnos
  await a.goto(`${BASE}/admin/pacientes?q=${encodeURIComponent(n1)}`);
  await a.click(`text=${n1}`);
  await a.waitForURL("**/admin/pacientes/*");
  const html = await a.content();
  check(
    "el perfil muestra los próximos turnos",
    html.includes("Próximos turnos") && html.includes("Sin confirmar"),
  );

  // la restricción también vive en la base
  let dbError = "";
  try {
    await sql(
      `insert into events(kind,title,starts_at,ends_at) values ('other','x','${mon}T13:20:00Z','${mon}T13:40:00Z')`,
    );
  } catch (e) {
    dbError = String((e as Error).message);
  }
  check(
    "la base rechaza superposiciones aunque la app falle",
    dbError.includes("events_no_overlap"),
  );

  // celular
  const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await m.newPage();
  await loginAdmin(mp);
  await mp.waitForURL("**/admin");
  await mp.goto(`${BASE}/admin?fecha=${mon}`);
  check(
    "celular: lista por día con la cita",
    (await mp.locator("a[href^='/admin/agenda/']:not([href*='/cita/']):not([href*='/evento/']):visible").count()) >= 1 &&
      (await mp.innerText("main")).includes(n1),
  );

  // permisos
  const pc = await browser.newContext();
  const pg = await pc.newPage();
  await login(pg, "demo1@example.com", DEMO_PASSWORD);
  await pg.waitForURL("**/paciente");
  await pg.goto(`${BASE}/admin/agenda/cita/nueva`);
  await pg.waitForURL("**/paciente");
  check("una paciente no accede a la agenda", true);
  await pg.goto(`${BASE}/admin`);
  await pg.waitForURL("**/paciente");
  check("una paciente no ve /admin", true);
  await Promise.all([c, m, pc].map((x) => x.close()));
});
