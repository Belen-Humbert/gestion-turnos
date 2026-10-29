import "dotenv/config";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { db, pool } from "@/db";
import { events, pushSubscriptions, reminderLog, users } from "@/db/schema";
import type { SendResult } from "./mailer";
import type { PushResult } from "./push";
import { runReminders } from "./reminders";

// Prueba de integración: necesita la base de desarrollo (DATABASE_URL). Usa fechas en 2031 y
// correos rem-test-* para no mezclarse con datos reales, y limpia todo al terminar.
const NOW = new Date("2031-03-03T12:00:00Z");
const H = 3600_000;
const LONG_AGO = new Date("2031-02-01T00:00:00Z");

const sentMail: { to: string; subject: string }[] = [];
const sentPush: { endpoint: string; body: string }[] = [];
const senders = {
  email: vi.fn(async (m: { to: string; subject: string }): Promise<SendResult> => {
    sentMail.push({ to: m.to, subject: m.subject });
    return "sent";
  }),
  push: vi.fn(async (s: { endpoint: string }, p: { body: string }): Promise<PushResult> => {
    sentPush.push({ endpoint: s.endpoint, body: p.body });
    return "sent";
  }),
};

let n = 0;
async function patient(over: Partial<typeof users.$inferInsert> = {}) {
  n++;
  const [u] = await db
    .insert(users)
    .values({ role: "patient", name: `Paciente Prueba ${n}`, email: `rem-test-${n}-${Date.now()}@example.com`, passwordHash: "x", ...over })
    .returning();
  return u;
}
async function appt(patientId: string, startsInMs: number, over: Partial<typeof events.$inferInsert> = {}) {
  const startsAt = new Date(NOW.getTime() + startsInMs);
  const [e] = await db
    .insert(events)
    .values({
      kind: "appointment",
      patientId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 45 * 60_000),
      location: "Consultorio",
      createdAt: LONG_AGO,
      ...over,
    })
    .returning();
  return e;
}
const run = (now = NOW) => runReminders({ now, senders, appUrl: "https://turnos.test" });

async function cleanup() {
  const ids = (await db.select({ id: users.id }).from(users).where(like(users.email, "rem-test-%"))).map((u) => u.id);
  for (const id of ids) {
    const evs = await db.select({ id: events.id }).from(events).where(eq(events.patientId, id));
    for (const e of evs) await db.delete(reminderLog).where(eq(reminderLog.eventId, e.id));
    await db.delete(events).where(eq(events.patientId, id));
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
}

describe.skipIf(!process.env.DATABASE_URL)("runReminders (con base de datos)", () => {
  beforeEach(async () => {
    sentMail.length = 0;
    sentPush.length = 0;
    senders.email.mockClear();
    senders.push.mockClear();
    await cleanup();
  });
  afterEach(cleanup);
  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it("manda el aviso de 24 h por email y push, y no lo repite", async () => {
    const u = await patient();
    await db.insert(pushSubscriptions).values({ userId: u.id, endpoint: `https://push.test/${u.id}`, p256dh: "k", auth: "a" });
    await appt(u.id, 23 * H);
    expect(await run()).toMatchObject({ email: 1, push: 1, errors: 0 });
    expect(sentMail).toEqual([{ to: u.email, subject: expect.stringContaining("mañana") }]);
    expect(sentPush).toHaveLength(1);
    expect(await run()).toMatchObject({ email: 0, push: 0 });
    expect(await run(new Date(NOW.getTime() + 10 * 60_000))).toMatchObject({ email: 0, push: 0 });
  });

  it("manda el de 2 h cuando llega el momento y distingue los dos avisos", async () => {
    const u = await patient();
    await appt(u.id, 23 * H);
    await run();
    const later = new Date(NOW.getTime() + 21 * H + 30 * 60_000); // faltan 1 h 30
    await run(later);
    expect(sentMail.map((m) => m.subject)).toEqual([
      expect.stringContaining("mañana"),
      expect.stringContaining("hoy"),
    ]);
  });

  it("respeta las preferencias del paciente", async () => {
    const noEmail = await patient({ remindEmail: false });
    const no24 = await patient({ remind24h: false });
    await appt(noEmail.id, 23 * H);
    await appt(no24.id, 22 * H);
    await run();
    expect(sentMail).toHaveLength(0);
  });

  it("solo manda push a quien activó un dispositivo", async () => {
    const u = await patient({ remindEmail: false });
    await appt(u.id, 23 * H);
    expect(await run()).toMatchObject({ email: 0, push: 0 });
  });

  it("ignora citas canceladas, pacientes inactivos y otros eventos", async () => {
    const a = await patient();
    const b = await patient({ active: false });
    await appt(a.id, 23 * H, { cancelledAt: NOW });
    await appt(b.id, 22 * H);
    await run();
    expect(sentMail).toHaveLength(0);
  });

  it("no manda el aviso de 24 h si la cita se agendó con menos de 24 h", async () => {
    const u = await patient();
    await appt(u.id, 23 * H, { createdAt: new Date(NOW.getTime() - H / 2) });
    await run();
    expect(sentMail).toHaveLength(0);
  });

  it("si el envío falla, se reintenta en la próxima corrida", async () => {
    const u = await patient();
    await appt(u.id, 23 * H);
    senders.email.mockRejectedValueOnce(new Error("SMTP caído"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await run()).toMatchObject({ email: 0, errors: 1 });
    spy.mockRestore();
    expect(await run()).toMatchObject({ email: 1, errors: 0 });
  });

  it("un envío simulado no consume el aviso", async () => {
    const u = await patient();
    await appt(u.id, 23 * H);
    senders.email.mockResolvedValueOnce("simulated");
    expect(await run()).toMatchObject({ email: 0 });
    expect(await run()).toMatchObject({ email: 1 });
  });

  it("borra los dispositivos dados de baja", async () => {
    const u = await patient({ remindEmail: false });
    await db.insert(pushSubscriptions).values({ userId: u.id, endpoint: `https://push.test/gone-${u.id}`, p256dh: "k", auth: "a" });
    await appt(u.id, 23 * H);
    senders.push.mockResolvedValueOnce("gone");
    await run();
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, u.id))).toHaveLength(0);
  });

  it("al reprogramar (borrar el registro) vuelve a avisar", async () => {
    const u = await patient();
    const e = await appt(u.id, 23 * H);
    await run();
    await db.delete(reminderLog).where(eq(reminderLog.eventId, e.id));
    expect(await run()).toMatchObject({ email: 1 });
  });
});
