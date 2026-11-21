import { test } from "@playwright/test";
import { BASE_MAIL as B, SMTP_PORT } from "./env";
import {
  check,
  closeDb,
  DEMO_PASSWORD as PW,
  login,
  seedDemo,
  sql,
  startSmtpSink,
  waitFor,
  type Mail,
} from "./support";

// Recuperar contraseña por email (con un servidor SMTP de prueba) y límite de intentos guardado en la base.
let sink: { mails: Mail[]; stop: () => Promise<void> };
test.beforeAll(async () => {
  sink = await startSmtpSink(SMTP_PORT);
});
test.afterAll(async () => {
  await sink.stop();
  await sql("delete from rate_limits");
  await closeDb();
});

const NEW = "una-clave-nueva-segura-1";

test("recuperar contraseña y límites de intentos", async ({ browser }) => {
  seedDemo();
  await sql("delete from rate_limits; delete from password_resets");
  const mails = sink.mails;
  mails.length = 0;
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const pg = await ctx.newPage();
  const other = await browser.newContext();
  const o = await other.newPage();
  await login(o, "demo1@example.com", PW, B);
  await o.waitForURL("**/paciente");
  const send = async (email: string) => {
    await pg.goto(`${B}/recuperar`);
    await pg.fill("#email", email);
    await pg.click("button[type=submit]");
  };

  await pg.goto(`${B}/login`);
  check(
    "el login tiene el link de «olvidé mi contraseña»",
    (await pg.locator("a:has-text('Olvidaste tu contraseña')").count()) === 1,
  );
  await pg.click("a:has-text('Olvidaste tu contraseña')");
  await pg.waitForURL("**/recuperar");
  await pg.fill("#email", "nadie@example.com");
  await pg.click("button[type=submit]");
  await pg.waitForSelector("[role=status]");
  const MSG = await pg.innerText("[role=status]");
  await pg.waitForTimeout(1500);
  check(
    "con un email que no existe se muestra el mismo mensaje y no sale ningún email",
    MSG.includes("Si ese email tiene una cuenta") && mails.length === 0,
  );
  await send("demo1@example.com");
  await pg.waitForSelector("[role=status]");
  check(
    "con un email real el mensaje es idéntico",
    (await pg.innerText("[role=status]")) === MSG,
  );
  check(
    "llega un email con el link",
    (await waitFor(() => mails.length >= 1)) &&
      mails[0].to[0] === "demo1@example.com",
  );
  const m = mails[0];
  const tok = /https?:\/\/\S+\/recuperar\/(\S+)/.exec(m.text)?.[1] ?? "";
  check(
    "el email es neutro y trae un link de recuperación",
    Boolean(tok) &&
      !m.text.toLowerCase().includes("turno") &&
      m.subject.includes("Recuper"),
  );
  check(
    "en la base solo queda el hash del link, no el link",
    (await sql("select count(*) from password_resets")) === "1" &&
      Boolean(tok) &&
      !(await sql("select token_hash from password_resets")).includes(tok),
  );
  await pg.goto(`${B}/recuperar/${tok}`);
  check(
    "el link abre el formulario de contraseña nueva",
    (await pg.locator("input[name=password]").count()) === 1 &&
      (await pg.innerText("h1")).includes("Lucía"),
  );
  await pg.fill("input[name=password]", "corta");
  await pg.fill("input[name=confirm]", "corta");
  await pg.click("button[type=submit]");
  await pg.waitForSelector("[role=alert]");
  check(
    "una contraseña corta se rechaza",
    (await pg.innerText("[role=alert]")).includes("al menos 10"),
  );
  await pg.fill("input[name=password]", NEW);
  await pg.fill("input[name=confirm]", "otra-distinta-123");
  await pg.click("button[type=submit]");
  await pg.waitForSelector("[role=alert]:has-text('no coinciden')");
  check("si no coinciden se avisa", true);
  await pg.fill("input[name=password]", NEW);
  await pg.fill("input[name=confirm]", NEW);
  await pg.click("button[type=submit]");
  await pg.waitForURL(/\/login\?clave=nueva/);
  check(
    "al guardar vuelve al login con un aviso",
    (await pg.innerText("main")).includes("cambiaste tu contraseña"),
  );
  await o.reload();
  await o.waitForURL("**/login");
  check("la sesión abierta en otro dispositivo se cerró", true);
  await login(pg, "demo1@example.com", PW, B);
  await pg.waitForSelector("[role=alert], [aria-live]", { timeout: 8000 });
  check("la contraseña vieja ya no entra", !pg.url().includes("/paciente"));
  await login(pg, "demo1@example.com", NEW, B);
  await pg.waitForURL("**/paciente");
  check("la contraseña nueva entra", true);
  await pg.goto(`${B}/recuperar/${tok}`);
  check(
    "el link no se puede usar dos veces",
    (await pg.innerText("main")).includes("Link no válido"),
  );

  // vencido
  await ctx.clearCookies();
  await send("demo2@example.com");
  await pg.waitForSelector("[role=status]");
  await waitFor(() => mails.length >= 2);
  const tok2 = /\/recuperar\/(\S+)/.exec(mails[1].text)?.[1] ?? "";
  await sql(
    "update password_resets set expires_at=now()-interval '1 minute' where used_at is null",
  );
  await pg.goto(`${B}/recuperar/${tok2}`);
  check(
    "un link vencido no sirve",
    (await pg.innerText("main")).includes("Link no válido"),
  );
  await pg.goto(`${B}/recuperar/${"x".repeat(43)}`);
  check(
    "un link inventado no sirve",
    (await pg.innerText("main")).includes("Link no válido"),
  );

  // desactivado
  const n = mails.length;
  await sql("update users set active=false where email='demo3@example.com'");
  await send("demo3@example.com");
  await pg.waitForSelector("[role=status]");
  await pg.waitForTimeout(1500);
  check("una paciente desactivada no recibe link", mails.length === n);
  await sql("update users set active=true where email='demo3@example.com'");

  // límite de pedidos
  await sql("delete from rate_limits");
  for (let i = 0; i < 3; i++) {
    await send("demo4@example.com");
    await pg.waitForSelector("[role=status]");
  }
  await send("demo4@example.com");
  await pg.waitForSelector("[role=alert]");
  check(
    "más de 3 pedidos por hora para un email se frenan",
    (await pg.innerText("[role=alert]")).toLowerCase().includes("demasiados"),
  );

  // límite de login persistente y sin datos en claro
  await sql("delete from rate_limits");
  for (let i = 0; i < 9; i++) {
    await login(pg, "demo5@example.com", `mala-clave-${i}`, B);
    await pg.waitForSelector("[role=alert]");
  }
  check(
    "tras varios intentos fallidos el login se bloquea",
    (await pg.innerText("[role=alert]")).includes("Demasiados"),
  );
  check(
    "el bloqueo queda guardado en la base",
    (await sql("select count(*) from rate_limits where count>=8")) !== "0",
  );
  check(
    "la base no guarda el email ni la IP en claro",
    (await sql(
      "select count(*) from rate_limits where key like '%demo5%' or key like '%@%'",
    )) === "0",
  );
  await Promise.all([ctx, other].map((x) => x.close()));
});
