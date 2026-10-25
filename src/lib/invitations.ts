import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";
import { generateToken, hashToken } from "./tokens";

const INVITATION_DAYS = 7;

// Crea (o renueva) la invitación de un paciente y devuelve el token en claro, una sola vez.
export async function createInvitation(userId: string): Promise<string> {
  const token = generateToken();
  await db.delete(invitations).where(and(eq(invitations.userId, userId), isNull(invitations.usedAt)));
  await db.insert(invitations).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
}

export function invitationUrl(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/invitacion/${token}`;
}

export async function findValidInvitation(token: string) {
  const rows = await db
    .select({
      id: invitations.id,
      userId: invitations.userId,
      name: users.name,
      email: users.email,
    })
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.userId))
    .where(
      and(
        eq(invitations.tokenHash, hashToken(token)),
        isNull(invitations.usedAt),
        gt(invitations.expiresAt, new Date()),
        eq(users.active, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
