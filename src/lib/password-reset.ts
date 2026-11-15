import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { passwordResets, users } from "@/db/schema";
import { generateToken, hashToken } from "./tokens";

export const RESET_MINUTES = 60;

// Crea el link de recuperación y devuelve el token en claro, una sola vez. Anula los anteriores sin usar.
export async function createPasswordReset(userId: string): Promise<string> {
  const token = generateToken();
  await db.delete(passwordResets).where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)));
  await db.insert(passwordResets).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_MINUTES * 60 * 1000),
  });
  return token;
}

export function resetUrl(token: string, appUrl = process.env.APP_URL ?? "http://localhost:3000"): string {
  return `${appUrl.replace(/\/$/, "")}/recuperar/${token}`;
}

export async function findValidReset(token: string) {
  const [row] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId, name: users.name, email: users.email })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
        eq(users.active, true),
      ),
    )
    .limit(1);
  return row ?? null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Texto neutro: no menciona turnos ni nada del consultorio más que el nombre de la app.
export function passwordResetEmail(name: string, url: string) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const subject = "Recuperá tu contraseña";
  const text = `Hola ${first}, pediste cambiar tu contraseña. Entrá a este link para elegir una nueva (sirve por ${RESET_MINUTES} minutos): ${url}\n\nSi no lo pediste vos, ignorá este mensaje: tu contraseña sigue igual.`;
  const html = `<p>Hola ${esc(first)},</p><p>Pediste cambiar tu contraseña. <a href="${esc(url)}">Elegí una nueva acá</a>. El link sirve por ${RESET_MINUTES} minutos.</p><p>Si no lo pediste vos, ignorá este mensaje: tu contraseña sigue igual.</p>`;
  return { subject, text, html };
}
