import "dotenv/config";
import { phoneKey } from "../src/lib/phone";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";
import { eq, inArray, like, or } from "drizzle-orm";
import { db, pool } from "../src/db";
import { changeRequests, events, forumAttachments, forumComments, libraryComments, communityPosts, forumPosts, invitations, patientNotes, sessions, users } from "../src/db/schema";
import { addDays, localToDate, mondayOf, snapToWeekday, todayYmd } from "../src/lib/dates";
import { hashPassword } from "../src/lib/password";

// Datos de DEMOSTRACIÓN para mostrar la app completa (reunión con la cliente, capturas). Nunca usar en producción.
//   npm run seed:showcase            borra los datos de prueba anteriores y carga la demo
//   npm run seed:showcase -- --reset borra todo lo de la demo
// Los pacientes entran con demo1@example.com … demo5@example.com y la contraseña DEMO_PASSWORD.
// Las citas se arman alrededor de la semana actual, así que conviene correrlo el mismo día de la demo.
const DEMO_PASSWORD = "demo-paciente-123";
const PEOPLE = [
  { name: "Lucía Fernández", alias: "Luna", phone: "261 555 0101" },
  { name: "Martín Giménez", alias: "Cedro", phone: "261 555 0102" },
  { name: "Sofía Rodríguez", alias: "Brisa", phone: "261 555 0103" },
  { name: "Tomás Herrera", alias: "Nube", phone: "261 555 0104" },
  { name: "Valentina Ortiz", alias: "Roble", phone: "261 555 0105" },
  { name: "Joaquín Molina", alias: "Alba", phone: "261 555 0106" },
];
const OTHER_EVENTS = ["Clase: Psicología Clínica", "Supervisión de casos"];
const POSTS = ["Respiración guiada para dormir", "Lecturas de la semana", "Una postal de primavera"];

const storageRoot = () => path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".storage");

// --- Archivos de ejemplo generados acá mismo (sin descargar nada) ---------------------------------
function wav(seconds: number): Buffer {
  const rate = 22050;
  const n = rate * seconds;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    // Un tono suave que sube y baja despacio, como una respiración.
    const breath = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 8);
    const fade = Math.min(1, t / 1.5, (seconds - t) / 1.5);
    data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 220 * t) * 7000 * breath * fade), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

function pdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[()\\]/g, "\\$&");
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 20 : 13} Tf 60 ${760 - i * 26} Td (${esc(l)}) Tj ET`).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

function png(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      // Degradé verde a durazno, con un sol: una postal simple.
      const d = Math.hypot(x - w * 0.75, y - h * 0.3);
      const sun = d < h * 0.14 ? 1 : 0;
      raw[o] = sun ? 255 : Math.round(120 + (x / w) * 100);
      raw[o + 1] = sun ? 214 : Math.round(190 - (y / h) * 60);
      raw[o + 2] = sun ? 120 : Math.round(170 - (x / w) * 50);
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function saveFile(ext: string, bytes: Buffer) {
  const key = `forum/${randomUUID()}.${ext}`;
  const full = path.join(storageRoot(), key);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, bytes);
  return { key, size: bytes.length };
}

// --- Reinicio -------------------------------------------------------------------------------------
async function reset() {
  const demo = await db.select({ id: users.id }).from(users).where(like(users.email, "demo%@example.com"));
  const ids = demo.map((d) => d.id);
  const posts = await db.select({ id: forumPosts.id }).from(forumPosts).where(inArray(forumPosts.title, POSTS));
  if (posts.length) {
    const files = await db.select({ key: forumAttachments.storageKey }).from(forumAttachments).where(inArray(forumAttachments.postId, posts.map((p) => p.id)));
    for (const f of files) if (f.key) rmSync(path.join(storageRoot(), f.key), { force: true });
    await db.delete(forumPosts).where(inArray(forumPosts.id, posts.map((p) => p.id)));
  }
  await db.delete(events).where(inArray(events.title, OTHER_EVENTS));
  if (ids.length === 0) return;
  await db.delete(forumComments).where(inArray(forumComments.userId, ids));
  await db.delete(libraryComments).where(inArray(libraryComments.userId, ids));
  await db.delete(communityPosts).where(inArray(communityPosts.authorId, ids));
  await db.delete(changeRequests).where(inArray(changeRequests.patientId, ids));
  await db.delete(patientNotes).where(inArray(patientNotes.patientId, ids));
  await db.delete(events).where(inArray(events.patientId, ids));
  await db.delete(sessions).where(inArray(sessions.userId, ids));
  await db.delete(invitations).where(inArray(invitations.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Este script es solo para desarrollo y demos.");
  await reset();
  if (process.argv.includes("--reset")) return console.log("Datos de demostración borrados.");

  const [ana] = await db.select().from(users).where(or(eq(users.role, "admin")));
  if (!ana) throw new Error("Primero creá la cuenta de la administradora: npm run seed:admin");

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ids: string[] = [];
  for (const [i, p] of PEOPLE.entries()) {
    const [u] = await db.insert(users).values({ role: "patient", name: p.name, alias: p.alias, aliasKey: p.alias.toLowerCase(), email: `demo${i + 1}@example.com`, phone: p.phone, phoneKey: phoneKey(p.phone), passwordHash, active: i !== 5 }).returning({ id: users.id });
    ids.push(u.id);
  }

  // Semana base: la actual (si hoy es fin de semana, la que viene).
  const base = mondayOf(snapToWeekday(todayYmd()));
  const at = (week: number, weekday: number) => addDays(base, week * 7 + weekday);
  const put = async (values: Omit<typeof events.$inferInsert, "startsAt" | "endsAt">, day: string, from: string, minutes: number) => {
    const startsAt = localToDate(day, from);
    const [ev] = await db.insert(events).values({ ...values, startsAt, endsAt: new Date(startsAt.getTime() + minutes * 60000) }).returning({ id: events.id });
    return ev.id;
  };
  const cita = (patient: number, week: number, weekday: number, hm: string, confirmed: boolean, note?: string) =>
    put({ kind: "appointment", patientId: ids[patient], location: "Consultorio", confirmedAt: confirmed ? new Date() : null, privateNote: note ?? null }, at(week, weekday), hm, 45);

  // Turnos anteriores (ya confirmados) y próximos.
  for (const w of [-3, -2, -1]) await cita(0, w, 1, "10:00", true);
  for (const w of [-3, -2, -1]) await cita(1, w, 2, "11:00", true);
  for (const w of [-2, -1]) await cita(2, w, 3, "16:00", true);
  await cita(3, -1, 0, "17:00", true);
  await cita(0, 0, 1, "10:00", true, "Prefiere que los recordatorios lleguen por email.");
  await cita(1, 0, 2, "11:00", true);
  const sofia = await cita(2, 0, 3, "16:00", false);
  await cita(3, 0, 0, "17:00", false);
  await cita(4, 0, 4, "12:00", false);
  await cita(0, 1, 1, "10:00", false);
  await cita(1, 1, 2, "11:00", false);
  await cita(2, 1, 3, "16:00", false);
  await cita(4, 1, 4, "12:00", false);
  // Otros eventos de Ana (no avisan a ningún paciente).
  for (const w of [0, 1]) await put({ kind: "other", title: OTHER_EVENTS[0], location: "Facultad" }, at(w, 1), "14:00", 120);
  await put({ kind: "other", title: OTHER_EVENTS[1], privateNote: "Traer los casos de la semana." }, at(0, 4), "09:00", 60);

  await db.insert(changeRequests).values({ eventId: sofia, patientId: ids[2], message: "No voy a poder ese día. ¿Podemos coordinar otro horario?" });
  await db.insert(patientNotes).values([
    { patientId: ids[0], body: "Prefiere turnos a la mañana. Confirmar siempre por email." },
    { patientId: ids[1], body: "Llegar 10 minutos antes: viene desde otra ciudad." },
  ]);

  // Foro: tres publicaciones con material, comentarios, corazones y respuestas.
  const ago = (days: number, hour = 10) => new Date(Date.now() - days * 86400000 - (new Date().getHours() - hour) * 3600000);
  const [p1] = await db.insert(forumPosts).values({ title: POSTS[0], body: "Escuchalo antes de dormir, sentado o acostado. No hace falta hacerlo perfecto: con repetirlo unos días ya se nota.", createdAt: ago(12), updatedAt: ago(12), notifiedAt: ago(12) }).returning();
  const [p2] = await db.insert(forumPosts).values({ title: POSTS[1], body: "Dos lecturas cortas y un video para ver con calma esta semana.", createdAt: ago(6), updatedAt: ago(6), notifiedAt: ago(6) }).returning();
  const [p3] = await db.insert(forumPosts).values({ title: POSTS[2], body: "Una imagen para empezar la semana.", commentsOpen: false, createdAt: ago(2), updatedAt: ago(2) }).returning();

  const a1 = saveFile("wav", wav(24));
  const a2 = saveFile("pdf", pdf(["Guia rapida de respiracion", "1. Sentate comodo y apoya la espalda.", "2. Inhala por la nariz contando hasta 4.", "3. Sostene el aire contando hasta 7.", "4. Exhala despacio contando hasta 8.", "Repetilo 4 veces. Hacelo una vez al dia."]));
  const a3 = saveFile("png", png(480, 300));
  await db.insert(forumAttachments).values([
    { postId: p1.id, kind: "file", label: "Respiración guiada.wav", fileName: "Respiración guiada.wav", storageKey: a1.key, contentType: "audio/wav", sizeBytes: a1.size, position: 0 },
    { postId: p1.id, kind: "file", label: "Guía rápida de respiración.pdf", fileName: "Guía rápida de respiración.pdf", storageKey: a2.key, contentType: "application/pdf", sizeBytes: a2.size, position: 1 },
    { postId: p2.id, kind: "link", label: "Video de ejemplo: pausas activas (YouTube, no listado)", url: "https://www.youtube.com/", position: 0 },
    { postId: p2.id, kind: "link", label: "Artículo de ejemplo: la importancia del descanso", url: "https://www.argentina.gob.ar/salud", position: 1 },
    { postId: p3.id, kind: "file", label: "Postal de primavera.png", fileName: "Postal de primavera.png", storageKey: a3.key, contentType: "image/png", sizeBytes: a3.size, position: 0 },
  ]);

  const seen = new Date();
  const c = async (post: string, user: string, body: string, when: Date, extra: Partial<typeof forumComments.$inferInsert> = {}) =>
    (await db.insert(forumComments).values({ postId: post, userId: user, body, createdAt: when, adminSeenAt: seen, ...extra }).returning({ id: forumComments.id }))[0].id;
  const lucia = await c(p1.id, ids[0], "Lo probé anoche y me ayudó a dormirme más tranquila.", ago(11), { adminHeartedAt: seen, ownerSeenAt: null });
  await c(p1.id, ana.id, "¡Qué bueno, Lucía! Seguilo probando esta semana.", ago(11), { parentId: lucia, ownerSeenAt: null });
  const martin = await c(p1.id, ids[1], "¿Se puede hacer también por la mañana?", ago(10));
  await c(p1.id, ana.id, "Sí, Martín: cuando necesites bajar un cambio, a cualquier hora.", ago(10), { parentId: martin, ownerSeenAt: seen });
  await c(p1.id, ids[2], "Gracias por compartirlo.", ago(9), { adminHeartedAt: seen, ownerSeenAt: seen });
  await c(p2.id, ids[3], "Leí el artículo, muy claro. ¿Hay más como este?", ago(1), { adminSeenAt: null });

  console.log("Datos de demostración cargados.");
  console.log(`  Pacientes: demo1@example.com … demo5@example.com (demo6 está inactivo). Contraseña: ${DEMO_PASSWORD}`);
  console.log("  Ana: la cuenta de administradora que ya tengas.");
  console.log("  Foro: 3 publicaciones (audio+PDF, enlaces, imagen) con comentarios, corazones y respuestas.");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
