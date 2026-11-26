import "server-only";
import { and, asc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { invitations, users } from "@/db/schema";

// «Dado de alta»: terminó el tratamiento, ya no tiene turnos y conserva la cuenta para la comunidad.
// «Bloqueado»: Ana le cortó el acceso a la app.
export type PatientStatus = "invited" | "active" | "discharged" | "blocked";
export type PatientFilter = "todos" | "activos" | "invitados" | "alta" | "bloqueados";

export const STATUS_LABEL: Record<PatientStatus, string> = {
  invited: "Invitación pendiente",
  active: "En tratamiento",
  discharged: "Dado de alta",
  blocked: "Acceso bloqueado",
};

export function statusOf(p: { active: boolean; passwordHash: string | null; dischargedAt: Date | null }): PatientStatus {
  if (!p.active) return "blocked";
  if (p.dischargedAt) return "discharged";
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
    const digits = term.replace(/\D/g, "");
    conditions.push(
      or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
        // El celular se busca por sus dígitos, sin importar espacios ni guiones.
        digits.length >= 4 ? sql`regexp_replace(coalesce(${users.phone}, ''), '[^0-9]', '', 'g') like ${`%${digits}%`}` : undefined,
      )!,
    );
  }
  const live = and(eq(users.active, true), isNull(users.dischargedAt))!;
  if (filter === "activos") conditions.push(and(live, sql`${users.passwordHash} is not null`)!);
  if (filter === "invitados") conditions.push(and(live, sql`${users.passwordHash} is null`)!);
  if (filter === "alta") conditions.push(and(eq(users.active, true), isNotNull(users.dischargedAt))!);
  if (filter === "bloqueados") conditions.push(eq(users.active, false));

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      active: users.active,
      passwordHash: users.passwordHash,
      dischargedAt: users.dischargedAt,
    })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(sql`lower(${users.name})`));
  return rows.map(({ passwordHash, ...p }) => ({ ...p, status: statusOf({ active: p.active, passwordHash, dischargedAt: p.dischargedAt }) }));
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
      dischargedAt: users.dischargedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, id), eq(users.role, "patient")))
    .limit(1);
  if (!row) return null;
  const { passwordHash, ...p } = row;
  return { ...p, status: statusOf({ active: p.active, passwordHash, dischargedAt: p.dischargedAt }) };
}

export async function deletePendingInvitations(userId: string) {
  await db.delete(invitations).where(and(eq(invitations.userId, userId), sql`${invitations.usedAt} is null`));
}
