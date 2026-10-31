import "dotenv/config";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { db, pool } from "@/db";
import { forumPosts, pushSubscriptions, users } from "@/db/schema";
import type { SendResult } from "@/lib/mailer";
import type { PushResult } from "@/lib/push";
import { forumNoticeEmail, forumNoticePush, notifyPatientsOfPost } from "./notify";

// Prueba de integración (necesita DATABASE_URL). Usa correos notice-test-* y limpia al terminar.
// Los pacientes reales que haya en la base reciben "avisos" simulados con funciones falsas: no sale nada.
const mails: { to: string; subject: string; text: string }[] = [];
const pushes: { endpoint: string; body: string }[] = [];
const senders = {
  email: vi.fn(async (m: { to: string; subject: string; text: string }): Promise<SendResult> => {
    mails.push(m);
    return "sent";
  }),
  push: vi.fn(async (s: { endpoint: string }, p: { body: string }): Promise<PushResult> => {
    pushes.push({ endpoint: s.endpoint, body: p.body });
    return "sent";
  }),
};
const NOW = new Date("2031-05-05T12:00:00Z");
let n = 0;
async function patient(over: Partial<typeof users.$inferInsert> = {}) {
  n++;
  const [u] = await db
    .insert(users)
    .values({ role: "patient", name: `Paciente Aviso ${n}`, email: `notice-test-${n}-${Date.now()}@example.com`, passwordHash: "x", ...over })
    .returning();
  return u;
}
const mine = () => mails.filter((m) => m.to.startsWith("notice-test-"));
async function post() {
  const [p] = await db.insert(forumPosts).values({ title: "Título SECRETO del material", body: "Contenido reservado" }).returning();
  return p;
}
const run = (id: string, now = NOW) => notifyPatientsOfPost(id, { senders, appUrl: "https://turnos.test", now });
const notified = async (id: string) => (await db.select({ at: forumPosts.notifiedAt }).from(forumPosts).where(eq(forumPosts.id, id)))[0].at;

async function cleanup() {
  const ids = (await db.select({ id: users.id }).from(users).where(like(users.email, "notice-test-%"))).map((u) => u.id);
  for (const id of ids) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
  await db.delete(forumPosts).where(like(forumPosts.title, "Título SECRETO%"));
}

describe.skipIf(!process.env.DATABASE_URL)("notifyPatientsOfPost (con base de datos)", () => {
  beforeEach(async () => {
    mails.length = 0;
    pushes.length = 0;
    senders.email.mockClear();
    senders.push.mockClear();
    await cleanup();
  });
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it("avisa por email a un paciente activo y marca la publicación como avisada", async () => {
    const u = await patient();
    const p = await post();
    const r = await run(p.id);
    expect(r.skipped).toBe(false);
    expect(r.email).toBeGreaterThanOrEqual(1);
    expect(mine().map((m) => m.to)).toContain(u.email);
    expect((await notified(p.id))?.getTime()).toBe(NOW.getTime());
  });

  it("el aviso es neutro: no revela el título ni el contenido", async () => {
    await patient();
    const p = await post();
    await run(p.id);
    const m = mine()[0];
    expect(`${m.subject}${m.text}`).not.toMatch(/SECRETO|reservado/i);
    expect(m.text).toContain("https://turnos.test/paciente/foro");
    expect(JSON.stringify(forumNoticePush)).not.toMatch(/SECRETO|reservado/i);
    const html = forumNoticeEmail("<b>X</b> Y", "http://a").html;
    expect(html).not.toContain("<b>X</b>");
  });

  it("respeta las preferencias: sin avisos del foro, sin email o inactivo no reciben nada", async () => {
    const off = await patient({ notifyForum: false });
    const noEmail = await patient({ remindEmail: false });
    const inactive = await patient({ active: false });
    const notInvited = await patient({ passwordHash: null });
    const p = await post();
    await run(p.id);
    const to = mine().map((m) => m.to);
    for (const u of [off, noEmail, inactive, notInvited]) expect(to).not.toContain(u.email);
  });

  it("manda push a los dispositivos de quien lo activó, no a quien lo apagó", async () => {
    const a = await patient();
    const b = await patient({ remindPush: false });
    await db.insert(pushSubscriptions).values([
      { userId: a.id, endpoint: `https://fcm.googleapis.com/fcm/send/notice-a-${Date.now()}`, p256dh: "x".repeat(20), auth: "y".repeat(20) },
      { userId: b.id, endpoint: `https://fcm.googleapis.com/fcm/send/notice-b-${Date.now()}`, p256dh: "x".repeat(20), auth: "y".repeat(20) },
    ]);
    const p = await post();
    await run(p.id);
    const eps = pushes.map((x) => x.endpoint);
    expect(eps.some((e) => e.includes("notice-a-"))).toBe(true);
    expect(eps.some((e) => e.includes("notice-b-"))).toBe(false);
    expect(pushes[0].body).toBe("Hay material nuevo en el foro");
  });

  it("un doble clic no duplica el aviso, pero se puede volver a avisar después de un minuto", async () => {
    await patient();
    const p = await post();
    await run(p.id);
    const first = mine().length;
    const dup = await run(p.id, new Date(NOW.getTime() + 5_000));
    expect(dup.skipped).toBe(true);
    expect(mine().length).toBe(first);
    const later = await run(p.id, new Date(NOW.getTime() + 120_000));
    expect(later.skipped).toBe(false);
    expect(mine().length).toBe(first * 2);
  });

  it("si no sale ningún aviso real (modo simulado), la publicación no queda como avisada", async () => {
    await patient();
    const p = await post();
    const fake = { email: vi.fn(async (): Promise<SendResult> => "simulated"), push: vi.fn(async (): Promise<PushResult> => "simulated") };
    const r = await notifyPatientsOfPost(p.id, { senders: fake, now: NOW });
    expect(r.email + r.push).toBe(0);
    expect(r.simulated).toBeGreaterThanOrEqual(1);
    expect(await notified(p.id)).toBeNull();
  });

  it("un fallo de envío no frena a los demás ni marca la publicación", async () => {
    const a = await patient();
    const b = await patient();
    const p = await post();
    const flaky = {
      email: vi.fn(async (m: { to: string }): Promise<SendResult> => {
        if (m.to === a.email) throw new Error("SMTP caído");
        return "sent";
      }),
    };
    const r = await notifyPatientsOfPost(p.id, { senders: flaky, now: NOW });
    expect(r.errors).toBeGreaterThanOrEqual(1);
    expect(flaky.email.mock.calls.some(([m]) => m.to === b.email)).toBe(true);
  });

  it("una publicación inexistente no hace nada", async () => {
    const r = await run("00000000-0000-4000-8000-000000000000");
    expect(r.skipped).toBe(true);
    expect(mails.length).toBe(0);
  });

  it("borra dispositivos dados de baja", async () => {
    const a = await patient();
    const ep = `https://fcm.googleapis.com/fcm/send/notice-gone-${Date.now()}`;
    await db.insert(pushSubscriptions).values({ userId: a.id, endpoint: ep, p256dh: "x".repeat(20), auth: "y".repeat(20) });
    const p = await post();
    const gone = { push: vi.fn(async (): Promise<PushResult> => "gone"), email: senders.email };
    await notifyPatientsOfPost(p.id, { senders: gone, now: NOW });
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, ep))).toHaveLength(0);
  });
});
