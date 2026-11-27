import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { ADMIN, appEnv, BASE, DEMO_PASSWORD, e2eDatabaseUrl } from "./env";

export { ADMIN, BASE, DEMO_PASSWORD };

let pool: pg.Pool | null = null;

// Consulta SQL directa a la base e2e. Devuelve texto: filas separadas por salto de línea, columnas por «|»,
// booleanos como t/f y nulos vacíos (para escribir las comprobaciones de forma corta).
export async function sql(q: string): Promise<string> {
  pool ??= new pg.Pool({ connectionString: e2eDatabaseUrl(), max: 2 });
  const res = await pool.query({ text: q, rowMode: "array" });
  const rows = Array.isArray(res) ? res[res.length - 1] : res;
  return rows.rows
    .map((r: unknown[]) =>
      r
        .map((v) =>
          v === null ? "" : v === true ? "t" : v === false ? "f" : String(v),
        )
        .join("|"),
    )
    .join("\n");
}

export async function closeDb() {
  await pool?.end();
  pool = null;
}

// Comprobación con nombre: si falla, el informe dice cuál fue, y la prueba sigue con las demás.
export function check(name: string, cond: unknown) {
  expect.soft(Boolean(cond), name).toBe(true);
}

function npm(script: string, extra = "") {
  execSync(`npm run ${script}${extra}`, {
    stdio: "pipe",
    env: appEnv() as NodeJS.ProcessEnv,
  });
}

// Deja los pacientes de demostración como nuevos (demo1@example.com … demo6@example.com).
export function seedDemo() {
  npm("seed:demo", " -- --reset");
  npm("seed:demo");
}

// Borra todas las citas (y lo que cuelga de ellas) para probar con una agenda vacía.
export async function clearEvents() {
  await sql(
    "delete from change_requests; delete from reminder_log; delete from events",
  );
}

export function resetForumStorage() {
  rmSync(path.join(process.cwd(), ".storage-e2e"), {
    recursive: true,
    force: true,
  });
}

export async function login(
  page: Page,
  email: string,
  password: string,
  base = BASE,
) {
  await page.goto(`${base}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}

export const loginAdmin = (page: Page, base = BASE) =>
  login(page, ADMIN.email, ADMIN.password, base);

// Celular argentino válido y distinto en cada llamada (formato 261 6xx xxxx).
export function uniqPhone() {
  return `261 6${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}`;
}

// Elige un paciente en «Agendar cita» usando el buscador.
export async function pickPatient(page: Page, name: string) {
  // si ya hay un paciente elegido, la lista está cerrada: se reabre con «Cambiar paciente»
  const change = page.locator("button:has-text('Cambiar paciente')");
  if (await change.count()) await change.click();
  await page.fill("#patientSearch", name);
  const value = await page.locator("#patientId option", { hasText: name }).first().getAttribute("value");
  await page.selectOption("#patientId", value!);
}

export function uniq() {
  return String(Date.now()).slice(-6);
}

// ---- fechas: todas relativas a hoy, así las pruebas no vencen -------------------------------------
const TZ = "America/Argentina/Buenos_Aires";
export function ymd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Primer lunes que cae al menos `minDays` días en el futuro.
export function futureMonday(minDays = 14): string {
  let d = addDays(ymd(new Date()), minDays);
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 1) d = addDays(d, 1);
  return d;
}
export function longMonthName(date: string): string {
  const s = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- servidor SMTP mínimo: guarda los emails que manda la app (puerto 2525) -----------------------
export type Mail = { to: string[]; subject: string; text: string };

export function startSmtpSink(port: number) {
  const mails: Mail[] = [];
  const server = net.createServer((sock) => {
    const w = (s: string) => sock.write(s + "\r\n");
    let to: string[] = [];
    let inData = false;
    let buf = "";
    let pending = "";
    w("220 sink ready");
    sock.on("data", (chunk) => {
      pending += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = pending.indexOf("\r\n.\r\n");
          if (end < 0) return;
          buf = pending.slice(0, end);
          pending = pending.slice(end + 5);
          inData = false;
          mails.push(parseMail(to, buf));
          w("250 queued");
          continue;
        }
        const nl = pending.indexOf("\r\n");
        if (nl < 0) return;
        const line = pending.slice(0, nl);
        pending = pending.slice(nl + 2);
        const u = line.toUpperCase();
        if (u.startsWith("EHLO") || u.startsWith("HELO")) w("250 sink");
        else if (u.startsWith("MAIL")) {
          to = [];
          w("250 ok");
        } else if (u.startsWith("RCPT")) {
          to.push(line.split(":")[1].replace(/[<>\s]/g, ""));
          w("250 ok");
        } else if (u === "DATA") {
          inData = true;
          w("354 go");
        } else if (u === "QUIT") {
          w("221 bye");
          sock.end();
          return;
        } else w("250 ok");
      }
    });
    sock.on("error", () => {});
  });
  return new Promise<{ mails: Mail[]; stop: () => Promise<void> }>(
    (resolve) => {
      server.listen(port, "127.0.0.1", () =>
        resolve({
          mails,
          stop: () => new Promise((r) => server.close(() => r())),
        }),
      );
    },
  );
}

function decodeQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

function parseMail(to: string[], raw: string): Mail {
  const [head, ...rest] = raw.split("\r\n\r\n");
  const unfolded = head.replace(/\r\n[ \t]+/g, " ");
  let subject = /^Subject:\s*(.*)$/im.exec(unfolded)?.[1] ?? "";
  subject = subject.replace(
    /=\?utf-8\?([bq])\?([^?]*)\?=/gi,
    (_, enc: string, data: string) =>
      enc.toLowerCase() === "b"
        ? Buffer.from(data, "base64").toString("utf8")
        : Buffer.from(
            decodeQuotedPrintable(data.replace(/_/g, " ")),
            "latin1",
          ).toString("utf8"),
  );
  let body = rest.join("\r\n\r\n");
  const boundary = /boundary="?([^";\s]+)"?/i.exec(unfolded)?.[1];
  let encoding =
    /Content-Transfer-Encoding:\s*(\S+)/i.exec(unfolded)?.[1]?.toLowerCase() ??
    "7bit";
  if (boundary) {
    const part = body
      .split(`--${boundary}`)
      .find((p) => /Content-Type:\s*text\/plain/i.test(p));
    if (part) {
      const [ph, ...pb] = part.split("\r\n\r\n");
      encoding =
        /Content-Transfer-Encoding:\s*(\S+)/i.exec(ph)?.[1]?.toLowerCase() ??
        "7bit";
      body = pb.join("\r\n\r\n");
    }
  }
  const text =
    encoding === "base64"
      ? Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8")
      : encoding === "quoted-printable"
        ? Buffer.from(decodeQuotedPrintable(body), "latin1").toString("utf8")
        : body;
  return { to, subject, text };
}

export async function waitFor(
  cond: () => boolean | Promise<boolean>,
  ms = 10_000,
): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await cond()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
