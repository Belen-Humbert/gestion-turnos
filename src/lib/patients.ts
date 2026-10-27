import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";

export type PatientStatus = "invited" | "active" | "inactive";
export type PatientFilter = "todos" | "activos" | "invitados" | "inactivos";

export const STATUS_LABEL: Record<PatientStatus, string> = {
  invited: "Invitación pendiente",
  active: "Activo",
  inactive: "Inactivo",
};

export function statusOf(p: { active: boolean; passwordHash: string | null }): PatientStatus {
  if (!p.active) return "inactive";
  return p.passwordHash ? "active" : "invited";
}

// Escapa % y _ para que la búsqueda trate el texto literalmente.
function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listPatients({ q, filter }: { q?: string; filter?: PatientFilter }) {
  const conditions = [eq(users.role, "patient")];
  const term = q?.trim();
  if (term) {
    const pattern = likePattern(term);
    conditions.push(or(ilike(users.name, pattern), ilike(users.email, pattern))!);
  }
  if (filter === "activos") conditions.push(and(eq(users.active, true), sql`${users.passwordHash} is not null`)!);
  if (filter === "invitados") conditions.push(and(eq(users.active, true), sql`${users.passwordHash} is null`)!);
  if (filter === "inactivos") conditions.push(eq(users.active, false));

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      active: users.active,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(sql`lower(${users.name})`));
  return rows.map(({ passwordHash, ...p }) => ({ ...p, status: statusOf({ active: p.active, passwordHash }) }));
}

export async function getPatient(id: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      active: users.active,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "patient")))
    .limit(1);
  if (!row) return null;
  const { passwordHash, ...p } = row;
  return { ...p, status: statusOf({ active: p.active, passwordHash }) };
}

export async function deletePendingInvitations(userId: string) {
  await db.delete(invitations).where(and(eq(invitations.userId, userId), sql`${invitations.usedAt} is null`));
}
