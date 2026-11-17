"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResets, sessions, users } from "@/db/schema";
import { sendMail } from "@/lib/mailer";
import { findValidReset, createPasswordReset, passwordResetEmail, resetUrl } from "@/lib/password-reset";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { isLimited, registerFailure } from "@/lib/rate-limit";

export type RecoverState = { error?: string; sent?: boolean; email?: string } | undefined;

const HOUR = 60 * 60 * 1000;

// Pide el link de recuperación. La respuesta es siempre la misma exista o no el email, para que
// nadie pueda averiguar quién es paciente. El envío se hace después de responder para que tampoco
// se note en el tiempo.
export async function requestReset(_prev: RecoverState, formData: FormData): Promise<RecoverState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  const typed = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Revisá el email.", email: typed };
  const email = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const ipKey = `reset-ip:${ip}`;
  const mailKey = `reset-mail:${email}`;
  if ((await isLimited(ipKey, 10)) || (await isLimited(mailKey, 3))) {
    return { error: "Pediste demasiados links. Probá de nuevo en un rato.", email };
  }
  await registerFailure(ipKey, HOUR);
  await registerFailure(mailKey, HOUR);

  after(async () => {
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.email, email), eq(users.active, true), isNotNull(users.passwordHash)))
      .limit(1);
    if (!user) return;
    const token = await createPasswordReset(user.id);
    await sendMail({ to: user.email, ...passwordResetEmail(user.name, resetUrl(token)) }).catch(() => {});
  });
  return { sent: true, email };
}

export type ResetState = { error?: string } | undefined;

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] });

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = resetSchema.safeParse({ token: formData.get("token"), password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const reset = await findValidReset(parsed.data.token);
  if (!reset) return { error: "El link venció o ya fue usado. Pedí uno nuevo." };

  // Marcar como usado con condición evita que dos pedidos simultáneos lo usen a la vez.
  const claimed = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.id, reset.id), isNull(passwordResets.usedAt)))
    .returning({ id: passwordResets.id });
  if (claimed.length === 0) return { error: "El link ya fue usado." };

  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.password) }).where(eq(users.id, reset.userId));
  // Quien tuviera una sesión abierta (por ejemplo alguien que conocía la clave vieja) queda afuera.
  await db.delete(sessions).where(eq(sessions.userId, reset.userId));
  redirect("/login?clave=nueva");
}
