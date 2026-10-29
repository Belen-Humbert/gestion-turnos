"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { pushSubscriptions, sessions, users } from "@/db/schema";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/password";
import { clearAttempts, isLimited, registerFailure } from "@/lib/rate-limit";
import { requireUser, SESSION_COOKIE } from "@/lib/session";
import { hashToken } from "@/lib/tokens";

export type ProfileFormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

const phoneSchema = z
  .string()
  .trim()
  .max(30, "El teléfono es demasiado largo.")
  .regex(/^[0-9+()\-\s]*$/, "El teléfono solo puede tener números, espacios, +, - y paréntesis.");

export async function updatePhone(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser("patient");
  const raw = String(formData.get("phone") ?? "");
  const phone = phoneSchema.safeParse(raw);
  if (!phone.success) return { error: phone.error.issues[0]?.message ?? "Teléfono inválido.", values: { phone: raw } };
  await db
    .update(users)
    .set({ phone: phone.data === "" ? null : phone.data })
    .where(eq(users.id, user.id));
  revalidatePath("/paciente/perfil");
  return { ok: "Teléfono guardado.", values: { phone: phone.data } };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Escribí tu contraseña actual."),
    password: z.string().min(MIN_PASSWORD_LENGTH, `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`).max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas nuevas no coinciden.", path: ["confirm"] });

export async function changePassword(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser("patient");
  const key = `pwchange:${user.id}`;
  if (isLimited(key)) return { error: "Demasiados intentos. Probá de nuevo en unos minutos." };

  const parsed = passwordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row?.hash || !(await verifyPassword(parsed.data.current, row.hash))) {
    registerFailure(key);
    return { error: "La contraseña actual no es correcta." };
  }
  if (parsed.data.current === parsed.data.password) return { error: "La contraseña nueva tiene que ser distinta de la actual." };

  clearAttempts(key);
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, user.id));
  // Cierra las sesiones en otros dispositivos y conserva la actual.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.tokenHash, hashToken(token))));
  return { ok: "Contraseña actualizada. Se cerró la sesión en tus otros dispositivos." };
}

export async function updateReminders(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await requireUser("patient");
  const on = (name: string) => formData.get(name) === "on";
  await db
    .update(users)
    .set({
      remindEmail: on("remindEmail"),
      remindPush: on("remindPush"),
      remind24h: on("remind24h"),
      remind2h: on("remind2h"),
    })
    .where(eq(users.id, user.id));
  revalidatePath("/paciente/perfil");
  return { ok: "Preferencias guardadas." };
}

const subSchema = z.object({
  endpoint: z.string().max(1000).refine(isAllowedPushEndpoint),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(10).max(300) }),
});

// Guarda el dispositivo del paciente para enviarle notificaciones. El endpoint es único:
// si el mismo dispositivo cambia de cuenta, queda asociado a la cuenta actual.
export async function savePushSubscription(raw: unknown): Promise<{ ok: boolean }> {
  const user = await requireUser("patient");
  const sub = subSchema.safeParse(raw);
  if (!sub.success) return { ok: false };
  await db
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint: sub.data.endpoint, p256dh: sub.data.keys.p256dh, auth: sub.data.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: sub.data.keys.p256dh, auth: sub.data.keys.auth },
    });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const user = await requireUser("patient");
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false };
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
  return { ok: true };
}
