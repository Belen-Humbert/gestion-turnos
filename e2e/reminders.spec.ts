import { test } from "@playwright/test";
import { BASE_MAIL as B, CRON_SECRET, SMTP_PORT } from "./env";
import {
  check,
  closeDb,
  DEMO_PASSWORD as PW,
  login,
  loginAdmin,
  seedDemo,
  sql,
  startSmtpSink,
  waitFor,
  type Mail,
} from "./support";

// Recordatorios: cron protegido, email por SMTP de prueba, notificaciones push del navegador y WhatsApp manual.
let sink: { mails: Mail[]; stop: () => Promise<void> };
test.beforeAll(async () => {
  sink = await startSmtpSink(SMTP_PORT);
});
test.afterAll(async () => {
  await sink.stop();
  await closeDb();
});

async function cron(
  auth?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const r = await fetch(`${B}/api/cron/reminders`, {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
  });
  return {
    status: r.status,
    body: (await r.json().catch(() => ({}))) as Record<string, unknown>,
  };
}

test("recordatorios, push y WhatsApp manual", async ({ browser }) => {
  seedDemo();
  await sql("delete from reminder_log");
  check("el cron sin clave da 401", (await cron()).status === 401);
  check(
    "el cron con clave incorrecta da 401",
    (await cron("Bearer otra-clave-incorrecta-1")).status === 401,
  );
  check(
    "el cron con la clave correcta da 200",
    (await cron(`Bearer ${CRON_SECRET}`)).status === 200,
  );

  // una cita a 23,5 h, creada hace tiempo: hay que avisar
  const ev = await sql(
    "select e.id from events e join users u on u.id=e.patient_id where u.email='demo2@example.com' and e.cancelled_at is null limit 1",
  );
  await sql(
    `update events set starts_at=now()+interval '23 hours 30 minutes', ends_at=now()+interval '24 hours 15 minutes', created_at=now()-interval '3 days' where id='${ev}'`,
  );
  await sql(`delete from reminder_log where event_id='${ev}'`);
  const first = await cron(`Bearer ${CRON_SECRET}`);
  check(
    "el cron detecta la cita a avisar",
    first.status === 200 && Number(first.body.candidates) >= 1,
  );
  check(
    "el email llega al servidor de prueba, neutro y sin la nota privada",
    await waitFor(() =>
      sink.mails.some(
        (m) =>
          m.to.includes("demo2@example.com") &&
          !m.text.includes("Nota de prueba"),
      ),
    ),
  );
  check(
    "el recordatorio por email queda registrado",
    (await sql(
      `select count(*) from reminder_log where event_id='${ev}' and channel='email'`,
    )) === "1",
  );
  const count2 = sink.mails.filter((m) =>
    m.to.includes("demo2@example.com"),
  ).length;
  await cron(`Bearer ${CRON_SECRET}`);
  check(
    "una segunda pasada no repite el email",
    sink.mails.filter((m) => m.to.includes("demo2@example.com")).length ===
      count2,
  );

  // ---- notificaciones bloqueadas en el navegador
  const cb = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const bp = await cb.newPage();
  await login(bp, "demo3@example.com", PW, B);
  await bp.waitForURL("**/paciente");
  await bp.goto(`${B}/paciente/perfil?seccion=recordatorios`);
  await bp.waitForSelector("text=bloqueadas en este navegador", {
    timeout: 15_000,
  });
  check(
    "si el navegador las bloquea, lo explica",
    (await bp
      .locator("button:has-text('Activar en este dispositivo')")
      .count()) === 0,
  );

  // ---- activar notificaciones (se simula el servicio push del navegador)
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await c.grantPermissions(["notifications"], { origin: B });
  await c.addInitScript(`
    Object.defineProperty(Notification,'permission',{get:()=>window.__perm||'default'});
    Notification.requestPermission = async()=>{window.__perm='granted';return 'granted'};
    window.__ep = 'https://fcm.googleapis.com/fcm/send/fake-endpoint-demo2';
    window.__fakeSub = () => ({endpoint: window.__ep, toJSON(){return {endpoint: window.__ep, keys:{p256dh:'BPcFakeP256dhKey0123456789abcdef', auth:'fakeAuthKey012345'}}}, unsubscribe: async()=>true});
    const proto = window.PushManager && PushManager.prototype;
    if (proto) {
      proto.getSubscription = async function(){ return window.__current || null; };
      proto.subscribe = async function(){ window.__current = window.__fakeSub(); return window.__current; };
    }
  `);
  const a = await c.newPage();
  await login(a, "demo2@example.com", PW, B);
  await a.waitForURL("**/paciente");
  await a.goto(`${B}/paciente/perfil?seccion=recordatorios`);
  await a.waitForSelector("text=desactivadas en este dispositivo", {
    timeout: 15_000,
  });
  check("muestra el estado: notificaciones desactivadas", true);
  await a.click("button:has-text('Activar en este dispositivo')");
  await a.waitForSelector("text=✓ Las notificaciones están activadas");
  check(
    "activar guarda el dispositivo",
    (await sql(
      "select count(*) from push_subscriptions p join users u on u.id=p.user_id where u.email='demo2@example.com'",
    )) === "1",
  );
  await a.click("button:has-text('Desactivar en este dispositivo')");
  await a.waitForSelector("text=Las notificaciones están desactivadas");
  check(
    "desactivar borra el dispositivo",
    (await sql("select count(*) from push_subscriptions")) === "0",
  );
  await a.evaluate(
    () =>
      ((window as unknown as { __ep: string }).__ep =
        "https://169.254.169.254/latest/meta-data"),
  );
  await a.click("button:has-text('Activar en este dispositivo')");
  await a.waitForSelector("text=No se pudo completar");
  check(
    "rechaza una dirección interna (SSRF)",
    (await sql("select count(*) from push_subscriptions")) === "0",
  );
  // el cron no debe romperse aunque el envío push falle
  await a.evaluate(
    () =>
      ((window as unknown as { __ep: string }).__ep =
        "https://fcm.googleapis.com/fcm/send/fake-endpoint-demo2"),
  );
  await a.click("button:has-text('Activar en este dispositivo')");
  await a.waitForSelector("text=✓ Las notificaciones están activadas");
  const again = await cron(`Bearer ${CRON_SECRET}`);
  check(
    "el cron sobrevive a un fallo de envío push",
    again.status === 200 && "errors" in again.body,
  );
  check(
    "un envío fallido se puede reintentar (no queda marcado)",
    (await sql(
      `select count(*) from reminder_log where event_id='${ev}' and channel='push'`,
    )) === "0",
  );

  // ---- botón manual de WhatsApp
  const ca = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const ad = await ca.newPage();
  await loginAdmin(ad, B);
  await ad.waitForURL("**/admin");
  await ad.goto(`${B}/admin/agenda/${ev}`);
  const wa = ad.locator("a:has-text('Recordar por WhatsApp')");
  check("la cita futura tiene el botón de WhatsApp", (await wa.count()) === 1);
  const href = decodeURIComponent((await wa.getAttribute("href")) ?? "");
  check(
    "abre wa.me con el celular y un texto neutro",
    href.startsWith("https://wa.me/54") &&
      href.includes("te recuerdo tu turno"),
  );
  check("el texto no filtra la nota privada", !href.includes("Nota de prueba"));
  check(
    "es un enlace manual (no se envía solo)",
    (await wa.getAttribute("target")) === "_blank",
  );
  const pid = await sql("select id from users where email='demo2@example.com'");
  await ad.goto(`${B}/admin/pacientes/${pid}`);
  check(
    "también está en el perfil del paciente",
    (await ad.locator("a:has-text('Recordar por WhatsApp')").count()) >= 1,
  );
  await sql("update users set phone=null where email='demo2@example.com'");
  await ad.reload();
  check(
    "sin celular no se muestra el botón",
    (await ad.locator("a:has-text('Recordar por WhatsApp')").count()) === 0,
  );
  await Promise.all([cb, c, ca].map((x) => x.close()));
});
