import { test } from "@playwright/test";
import { BASE, check, DEMO_PASSWORD, clearEvents, closeDb, loginAdmin, seedDemo, sql, waitFor } from "./support";

// Pago por turno: marcar efectivo / transferencia / pendiente, aviso al agendar el siguiente, historial y agenda.
test.afterAll(closeDb);

const pastTurno = (email: string, daysAgo: number) =>
  sql(
    `insert into events(kind,patient_id,starts_at,ends_at) select 'appointment', id, now() - interval '${daysAgo} days', now() - interval '${daysAgo} days' + interval '50 minutes' from users where email='${email}'`,
  );
const status = async (email: string) =>
  (await sql(`select payment_status from events e join users u on u.id=e.patient_id where u.email='${email}' order by e.starts_at desc limit 1`)).trim();

test("pagos: marcar el pago, aviso al agendar y pendientes", async ({ browser }) => {
  seedDemo();
  await clearEvents();
  await pastTurno("demo1@example.com", 8);
  await pastTurno("demo1@example.com", 1);
  await pastTurno("demo2@example.com", 3);
  // un turno futuro nunca figura como pendiente
  await sql(
    "insert into events(kind,patient_id,starts_at,ends_at) select 'appointment', id, now() + interval '3 days', now() + interval '3 days 50 minutes' from users where email='demo3@example.com'",
  );

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await ctx.newPage();
  await loginAdmin(a);
  await a.waitForURL("**/admin");
  check("los turnos nuevos arrancan pendientes", (await status("demo1@example.com")) === "pending");

  // al agendar el siguiente turno avisa de los anteriores sin pagar
  await a.goto(`${BASE}/admin/agenda/cita/nueva`);
  check("sin paciente elegido no hay aviso", (await a.locator("[aria-label='Pagos pendientes del paciente']").count()) === 0);
  await a.selectOption("#patientId", { label: "Lucía Fernández" });
  const notice = a.locator("[aria-label='Pagos pendientes del paciente']");
  await notice.waitFor();
  check("avisa que Lucía tiene 2 turnos sin pagar", (await notice.innerText()).includes("2 turnos anteriores sin pagar"));
  await a.selectOption("#patientId", { label: "Tomás Herrera" });
  check("un paciente sin turnos no muestra el aviso", await waitFor(async () => (await notice.count()) === 0));
  await a.selectOption("#patientId", { label: "Martín Giménez" });
  await notice.waitFor();
  check("avisa el turno anterior de Martín", (await notice.innerText()).includes("El turno anterior de Martín quedó sin pagar"));
  await a.selectOption("#patientId", { label: "Sofía Rodríguez" });
  check("un turno futuro no cuenta como deuda", await waitFor(async () => (await notice.count()) === 0));

  // se resuelve desde el aviso
  await a.selectOption("#patientId", { label: "Lucía Fernández" });
  await notice.waitFor();
  await notice.locator("button:has-text('Pagó efectivo')").first().click();
  check(
    "marcar efectivo desde el aviso",
    await waitFor(async () => (await sql("select count(*) from events where payment_status='cash'")) === "1"),
  );
  check(
    "el aviso queda con 1 turno",
    await waitFor(async () => (await notice.innerText()).includes("El turno anterior de Lucía quedó sin pagar")),
  );

  // desde la ficha del turno
  await a.goto(`${BASE}/admin/agenda/${(await sql("select e.id from events e join users u on u.id=e.patient_id where u.email='demo2@example.com'")).trim()}`);
  check("la ficha muestra el pago pendiente", (await a.content()).includes("no figura como pagado"));
  await a.click("button:has-text('Pagó transferencia')");
  check("marcar transferencia", await waitFor(async () => (await status("demo2@example.com")) === "transfer"));
  check("el botón elegido queda marcado", await waitFor(async () => (await a.locator("button[aria-pressed=true]:has-text('transferencia')").count()) === 1));
  await a.click("button:has-text('Pendiente')");
  check("volver a pendiente", await waitFor(async () => (await status("demo2@example.com")) === "pending"));

  // historial en la ficha del paciente
  const pid = (await sql("select id from users where email='demo1@example.com'")).trim();
  await a.goto(`${BASE}/admin/pacientes/${pid}`);
  const text = await a.innerText("body");
  check("la ficha del paciente lista los pagos", text.includes("Pagado en efectivo") && text.includes("1 turno sin pagar"));

  // en la agenda se ve «Sin pagar» (vista día)
  const d = (await sql("select to_char((now() - interval '3 days') at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD')")).trim();
  await a.goto(`${BASE}/admin?vista=dia&fecha=${d}`);
  check("la agenda marca el turno sin pagar", (await a.content()).includes("Sin pagar"));

  // el paciente no puede cambiar pagos
  const pc = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pt = await pc.newPage();
  await pt.goto(`${BASE}/login`);
  await pt.fill("#email", "demo2@example.com");
  await pt.fill("#password", DEMO_PASSWORD);
  await pt.click("button[type=submit]");
  await pt.waitForURL("**/paciente");
  check("el paciente no ve la sección de pagos", !(await pt.content()).includes("Pagó efectivo"));
  await ctx.close();
  await pc.close();
});
