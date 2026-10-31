import { and, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { forumPosts, pushSubscriptions, users } from "@/db/schema";
import { sendMail, type Mail, type SendResult } from "@/lib/mailer";
import { sendPush, type PushPayload, type PushResult, type PushSub } from "@/lib/push";

// Aviso de "hay material nuevo en el foro". El texto es deliberadamente neutro: no lleva el título ni
// el contenido de la publicación, porque puede verse en una pantalla bloqueada o en una bandeja compartida.
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function forumNoticeEmail(name: string, appUrl: string): Pick<Mail, "subject" | "text" | "html"> {
  const link = `${appUrl.replace(/\/$/, "")}/paciente/foro`;
  return {
    subject: "Hay material nuevo en el foro",
    text:
      `Hola ${firstName(name)},\n\nHay material nuevo en el foro. Podés verlo acá: ${link}\n\n` +
      `Podés cambiar estos avisos en Perfil → Recordatorios.\n`,
    html:
      `<p>Hola ${esc(firstName(name))},</p><p>Hay material nuevo en el foro.</p>` +
      `<p><a href="${esc(link)}">Ver el foro</a></p>` +
      `<p style="color:#5b6b66;font-size:13px">Podés cambiar estos avisos en Perfil → Recordatorios.</p>`,
  };
}

export const forumNoticePush: PushPayload = { title: "Foro", body: "Hay material nuevo en el foro", url: "/paciente/foro" };

export type NoticeSenders = {
  email: (mail: Mail) => Promise<SendResult>;
  push: (sub: PushSub, payload: PushPayload) => Promise<PushResult>;
};

export type NoticeSummary = {
  recipients: number; // pacientes a quienes les correspondía el aviso
  email: number; // emails realmente enviados
  push: number; // dispositivos notificados realmente
  simulated: number; // envíos simulados (falta configurar el servicio)
  errors: number;
  skipped: boolean; // true si ya se había avisado hace instantes (doble clic) o la publicación no existe
};

// Avisa a los pacientes activos que quieran estos avisos, por los canales que cada uno eligió.
// Solo se marca la publicación como avisada si salió al menos un aviso real.
export async function notifyPatientsOfPost(postId: string, opts: { senders?: Partial<NoticeSenders>; appUrl?: string; now?: Date } = {}): Promise<NoticeSummary> {
  const senders: NoticeSenders = { email: sendMail, push: sendPush, ...opts.senders };
  const appUrl = opts.appUrl ?? process.env.APP_URL ?? "http://localhost:3000";
  const summary: NoticeSummary = { recipients: 0, email: 0, push: 0, simulated: 0, errors: 0, skipped: false };

  const [post] = await db.select({ notifiedAt: forumPosts.notifiedAt }).from(forumPosts).where(eq(forumPosts.id, postId)).limit(1);
  if (!post) return { ...summary, skipped: true };

  // Evita avisos duplicados por un doble clic: la reserva es atómica y solo una pasa por ventana de un minuto.
  const now = opts.now ?? new Date();
  const claimed = await db
    .update(forumPosts)
    .set({ notifiedAt: now })
    .where(and(eq(forumPosts.id, postId), or(isNull(forumPosts.notifiedAt), lt(forumPosts.notifiedAt, new Date(now.getTime() - 60_000)))))
    .returning({ id: forumPosts.id });
  if (claimed.length === 0) return { ...summary, skipped: true };

  const patients = await db
    .select({ id: users.id, name: users.name, email: users.email, remindEmail: users.remindEmail, remindPush: users.remindPush })
    .from(users)
    .where(and(eq(users.role, "patient"), eq(users.active, true), eq(users.notifyForum, true), isNotNull(users.passwordHash)));
  summary.recipients = patients.length;

  const note = (r: SendResult | PushResult) => {
    if (r === "simulated") summary.simulated++;
    return r;
  };

  for (const p of patients) {
    if (p.remindEmail && p.email) {
      try {
        const r = note(await senders.email({ to: p.email, ...forumNoticeEmail(p.name, appUrl) }));
        if (r === "sent") summary.email++;
      } catch (e) {
        summary.errors++;
        console.error("No se pudo enviar el aviso del foro (email):", (e as Error).message);
      }
    }
    if (p.remindPush) {
      const subs = await db
        .select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, p.id));
      const results = await Promise.allSettled(subs.map((s) => senders.push(s, forumNoticePush)));
      const gone: string[] = [];
      results.forEach((res, i) => {
        if (res.status === "rejected") {
          summary.errors++;
          console.error("No se pudo enviar el aviso del foro (push):", (res.reason as Error).message);
        } else if (res.value === "gone") gone.push(subs[i].endpoint);
        else if (note(res.value) === "sent") summary.push++;
      });
      if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, gone));
    }
  }

  // Si no salió ningún aviso real, la publicación no se considera avisada.
  if (summary.email + summary.push === 0) {
    await db.update(forumPosts).set({ notifiedAt: post.notifiedAt }).where(eq(forumPosts.id, postId));
  }
  return summary;
}
