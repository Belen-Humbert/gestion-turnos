import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { events, pushSubscriptions, reminderLog, users } from "@/db/schema";
import { sendMail, type Mail, type SendResult } from "./mailer";
import { sendPush, type PushPayload, type PushResult, type PushSub } from "./push";
import { emailContent, pushContent } from "./reminder-messages";
import { dueKinds, LEAD_MS, type ReminderKind } from "./reminder-rules";

export type Senders = {
  email: (mail: Mail) => Promise<SendResult>;
  push: (sub: PushSub, payload: PushPayload) => Promise<PushResult>;
};

export type ReminderSummary = { candidates: number; email: number; push: number; errors: number };

// Revisa las citas próximas y envía los recordatorios que corresponden según las preferencias
// de cada paciente. Es idempotente: se puede correr cada pocos minutos sin duplicar avisos.
export async function runReminders(opts: { now?: Date; senders?: Partial<Senders>; appUrl?: string } = {}): Promise<ReminderSummary> {
  const now = opts.now ?? new Date();
  const senders: Senders = { email: sendMail, push: sendPush, ...opts.senders };
  const appUrl = opts.appUrl ?? process.env.APP_URL ?? "http://localhost:3000";
  const summary: ReminderSummary = { candidates: 0, email: 0, push: 0, errors: 0 };

  const rows = await db
    .select({
      eventId: events.id,
      startsAt: events.startsAt,
      createdAt: events.createdAt,
      location: events.location,
      userId: users.id,
      name: users.name,
      email: users.email,
      remindEmail: users.remindEmail,
      remindPush: users.remindPush,
      remind24h: users.remind24h,
      remind2h: users.remind2h,
    })
    .from(events)
    .innerJoin(users, eq(users.id, events.patientId))
    .where(
      and(
        eq(events.kind, "appointment"),
        isNull(events.cancelledAt),
        eq(users.active, true),
        eq(users.role, "patient"),
        gt(events.startsAt, now),
        lte(events.startsAt, new Date(now.getTime() + LEAD_MS["24h"])),
      ),
    );

  for (const r of rows) {
    const wanted = dueKinds(r.startsAt, r.createdAt, now).filter((k) => (k === "24h" ? r.remind24h : r.remind2h));
    if (wanted.length === 0) continue;
    summary.candidates++;
    for (const kind of wanted) {
      const input = { name: r.name, startsAt: r.startsAt, location: r.location, now };
      if (r.remindEmail && r.email) {
        await deliver(r.eventId, kind, "email", summary, async () => {
          return senders.email({ to: r.email, ...emailContent({ ...input, appUrl }) });
        });
      }
      if (r.remindPush) {
        const subs = await db
          .select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
          .from(pushSubscriptions)
          .where(eq(pushSubscriptions.userId, r.userId));
        if (subs.length === 0) continue;
        await deliver(r.eventId, kind, "push", summary, async () => {
          const results = await Promise.allSettled(subs.map((s) => senders.push(s, pushContent(input))));
          const gone = subs.filter((_, i) => {
            const res = results[i];
            return res.status === "fulfilled" && res.value === "gone";
          });
          if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, gone.map((g) => g.endpoint)));
          const ok = results.filter((x) => x.status === "fulfilled" && x.value !== "gone");
          if (ok.length === 0) {
            const failed = results.find((x) => x.status === "rejected");
            if (failed) throw (failed as PromiseRejectedResult).reason;
            return "gone" as const; // todos los dispositivos estaban dados de baja
          }
          return ok.some((x) => x.status === "fulfilled" && x.value === "sent") ? ("sent" as const) : ("simulated" as const);
        });
      }
    }
  }
  return summary;
}

// Reserva el envío en reminder_log antes de mandarlo. Si dos procesos coinciden, solo uno
// gana la reserva. Si el envío falla (o es simulado) se libera para reintentar en la próxima corrida.
async function deliver(
  eventId: string,
  kind: ReminderKind,
  channel: "email" | "push",
  summary: ReminderSummary,
  send: () => Promise<SendResult | PushResult>,
) {
  const claimed = await db.insert(reminderLog).values({ eventId, kind, channel }).onConflictDoNothing().returning({ id: reminderLog.id });
  if (claimed.length === 0) return;
  const release = () => db.delete(reminderLog).where(eq(reminderLog.id, claimed[0].id));
  try {
    const result = await send();
    if (result === "sent") summary[channel]++;
    else await release();
  } catch (e) {
    summary.errors++;
    console.error(`No se pudo enviar el recordatorio (${channel}, ${kind}):`, (e as Error).message);
    await release();
  }
}
