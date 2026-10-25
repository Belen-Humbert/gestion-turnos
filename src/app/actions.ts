"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { findValidInvitation } from "@/lib/invitations";
import { getDummyHash, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/password";
import { clearAttempts, isLimited, registerFailure } from "@/lib/rate-limit";
import { createSession, destroySession, homeFor } from "@/lib/session";

export type FormState = { error?: string; email?: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const typedEmail = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Revisá el email y la contraseña.", email: typedEmail };

  const { email, password } = parsed.data;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}|${email}`;
  if (isLimited(key)) {
    return { error: "Demasiados intentos. Probá de nuevo en unos minutos.", email };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !user.passwordHash || !user.active || !valid) {
    registerFailure(key);
    return { error: "Email o contraseña incorrectos.", email };
  }

  clearAttempts(key);
  await createSession(user.id);
  redirect(homeFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

const acceptSchema = z
  .object({
    token: z.string().min(10),
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Las contraseñas no coinciden.",
    path: ["confirm"],
  });

export async function acceptInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const invitation = await findValidInvitation(parsed.data.token);
  if (!invitation) return { error: "La invitación venció o ya fue usada. Pedí una nueva." };

  const passwordHash = await hashPassword(parsed.data.password);
  // Marcar como usada con condición evita que dos pedidos simultáneos la usen a la vez.
  const claimed = await db
    .update(invitations)
    .set({ usedAt: new Date() })
    .where(and(eq(invitations.id, invitation.id), isNull(invitations.usedAt)))
    .returning({ id: invitations.id });
  if (claimed.length === 0) return { error: "La invitación ya fue usada." };

  await db.update(users).set({ passwordHash }).where(eq(users.id, invitation.userId));
  await createSession(invitation.userId);
  redirect("/paciente");
}
