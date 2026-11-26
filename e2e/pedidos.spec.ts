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
} from "./support";

// Confirmar asistencia, pedidos de cambio, y cómo los atiende Ana (también al reprogramar o cancelar).
test.afterAll(closeDb);

test("confirmación y pedidos de cambio", async ({ browser }) => {
  seedDemo();
  const ev = (e: string) =>
    sql(
      `select e.id from events e join users u on u.id=e.patient_id where u.email='${e}' and e.cancelled_at is null order by starts_at limit 1`,
    );
  const [ev2, ev3] = [
    await ev("demo2@example.com"),
    await ev("demo3@example.com"),
  ];
  const c2 = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const a = await c2.newPage();
  await login(a, "demo2@example.com", DEMO_PASSWORD);
  await a.waitForURL("**/paciente");
  check(
    "ve su próximo turno",
    (await a.locator("article:has-text('Tu próximo turno')").count()) === 1,
  );
  check(
    "no se ve la nota privada",
    !(await a.content()).includes("Nota de prueba"),
  );
  await a.click("button:has-text('Confirmar asistencia')");
  await a.waitForSelector("text=Asistencia confirmada");
  check(
    "confirmar guarda confirmed_at",
    (await sql(
      `select confirmed_at is not null from events where id='${ev2}'`,
    )) === "t",
  );
  // mensaje vacío y largo
  await a.click("summary:has-text('Necesito cambiar')");
  await a.evaluate(() =>
    document.querySelector("textarea")!.removeAttribute("required"),
  );
  await a.fill("textarea", "   ");
  await a.click("button:has-text('Enviar mensaje')");
  await a.waitForSelector("text=Escribí un mensaje.");
  check(
    "un mensaje vacío se rechaza",
    (await sql(
      `select count(*) from change_requests where event_id='${ev2}'`,
    )) === "0",
  );
  await a.evaluate(() =>
    document.querySelector("textarea")!.removeAttribute("maxlength"),
  );
  await a.fill("textarea", "x".repeat(501));
  await a.click("button:has-text('Enviar mensaje')");
  await a.waitForSelector("text=demasiado largo");
  check(
    "un mensaje largo se rechaza",
    (await sql(
      `select count(*) from change_requests where event_id='${ev2}'`,
    )) === "0",
  );
  await a.fill("textarea", "No puedo ese día, ¿otro horario?");
  await a.click("button:has-text('Enviar mensaje')");
  await a.waitForSelector("text=Enviaste un pedido de cambio");
  check(
    "el pedido se guarda",
    (await sql(
      `select count(*) from change_requests where event_id='${ev2}' and resolved_at is null`,
    )) === "1",
  );
  await a.reload();
  check(
    "tras recargar sigue mostrando el pedido enviado",
    (await a.locator("text=Enviaste un pedido de cambio").count()) === 1 &&
      (await a.locator("summary:has-text('Necesito cambiar')").count()) === 0,
  );
  check(
    "el turno no cambió de horario",
    (await sql(
      `select count(*) from events where id='${ev2}' and cancelled_at is null`,
    )) === "1",
  );

  // paciente 1: no puede tocar el turno de otro
  const c1 = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const b = await c1.newPage();
  await login(b, "demo1@example.com", DEMO_PASSWORD);
  await b.waitForURL("**/paciente");
  check(
    "la paciente 1 no ve el turno de otro",
    !(await b.content()).includes("Martín"),
  );
  await b.click("summary:has-text('Necesito cambiar')");
  await b.evaluate(
    (id) =>
      document
        .querySelectorAll("input[name=eventId]")
        .forEach((i) => ((i as HTMLInputElement).value = id)),
    ev3,
  );
  await b.fill("textarea", "intento sobre turno ajeno");
  await b.click("button:has-text('Enviar mensaje')");
  await b.waitForSelector("text=No encontramos ese turno");
  check(
    "no puede pedir un cambio sobre un turno ajeno",
    (await sql(
      "select count(*) from change_requests where message like 'intento%'",
    )) === "0",
  );
  for (const p of ["/admin", "/admin/pedidos", "/admin/pacientes"]) {
    await b.goto(BASE + p);
    await b.waitForURL("**/paciente");
  }
  check("una paciente no accede al panel de Ana", true);

  // Ana
  const ca = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const ad = await ca.newPage();
  await loginAdmin(ad);
  await ad.waitForURL("**/admin");
  await ad.goto(`${BASE}/admin/pedidos`);
  check(
    "Ana ve los 2 pedidos pendientes",
    (await ad.locator("ul[aria-label='Pedidos pendientes'] > li").count()) ===
      2,
  );
  check(
    "el menú muestra el contador 2",
    (await ad.locator("aside a[href='/admin/pedidos']").innerText())
      .trim()
      .endsWith("2"),
  );
  const wa = await ad
    .locator("a:has-text('Responder por WhatsApp')")
    .first()
    .getAttribute("href");
  check(
    "hay un botón de WhatsApp manual",
    Boolean(wa?.startsWith("https://wa.me/")),
  );
  await ad
    .locator("li:has-text('Sofía') button:has-text('Marcar como atendido')")
    .click();
  await ad.waitForTimeout(1200);
  await ad.reload();
  check(
    "marcar como atendido lo saca de pendientes",
    (await ad.locator("ul[aria-label='Pedidos pendientes'] > li").count()) ===
      1,
  );
  check(
    "y aparece en atendidos",
    (await ad.locator("section[aria-label='Atendidos']").innerText()).includes(
      "Sofía",
    ),
  );
  // reprogramar desde la agenda resuelve el pedido
  await ad.goto(`${BASE}/admin/agenda/${ev2}`);
  check(
    "la cita muestra el pedido de la paciente",
    (await ad.locator("text=No puedo ese día").count()) === 1,
  );
  await ad.fill("#start", "17:00");
  await ad.click("form:has(#start) button[type=submit]");
  await ad.waitForURL("**/admin?fecha=*");
  check(
    "reprogramar resuelve el pedido y pide reconfirmar",
    (await sql(
      `select count(*) from change_requests where event_id='${ev2}' and resolved_at is null`,
    )) === "0" &&
      (await sql(
        `select confirmed_at is null from events where id='${ev2}'`,
      )) === "t",
  );
  check(
    "el aviso rojo de Pedidos se apaga al reprogramar",
    !(await ad.locator("aside a[href='/admin/pedidos']").innerText())
      .trim()
      .match(/\d/),
  );
  await a.reload();
  check(
    "la paciente vuelve a ver «Confirmar asistencia»",
    (await a.locator("button:has-text('Confirmar asistencia')").count()) === 1,
  );

  // cancelar también resuelve el pedido y apaga el aviso
  await sql(
    `insert into change_requests(event_id, patient_id, message) select '${ev3}', patient_id, 'Otro pedido' from events where id='${ev3}'`,
  );
  await ad.goto(`${BASE}/admin/pedidos`);
  check(
    "vuelve a aparecer el contador 1",
    (await ad.locator("aside a[href='/admin/pedidos']").innerText())
      .trim()
      .endsWith("1"),
  );
  await ad.goto(`${BASE}/admin/agenda/${ev3}`);
  ad.once("dialog", (d) => d.accept());
  await ad.click("button:has-text('Cancelar cita')");
  await ad.waitForURL("**/admin?fecha=*");
  check(
    "cancelar la cita resuelve su pedido",
    (await sql(
      "select count(*) from change_requests where resolved_at is null",
    )) === "0",
  );
  check(
    "y apaga el aviso rojo del menú",
    !(await ad.locator("aside a[href='/admin/pedidos']").innerText())
      .trim()
      .match(/\d/),
  );
  await Promise.all([c1, c2, ca].map((x) => x.close()));
});
