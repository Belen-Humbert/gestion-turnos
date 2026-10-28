import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { changeRequests, events } from "@/db/schema";

// Lo único que el paciente puede ver de una cita. Nunca incluye notas privadas ni el título.
export type PatientTurno = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  confirmedAt: Date | null;
  openRequest: { message: string; createdAt: Date } | null;
};

const cols = {
  id: events.id,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  location: events.location,
  confirmedAt: events.confirmedAt,
};

async function withRequests(rows: Omit<PatientTurno, "openRequest">[]): Promise<PatientTurno[]> {
  if (rows.length === 0) return [];
  const reqs = await db
    .select({ eventId: changeRequests.eventId, message: changeRequests.message, createdAt: changeRequests.createdAt })
    .from(changeRequests)
    .where(
      and(
        inArray(changeRequests.eventId, rows.map((r) => r.id)),
        isNull(changeRequests.resolvedAt),
      ),
    );
  const byEvent = new Map(reqs.map((r) => [r.eventId, { message: r.message, createdAt: r.createdAt }]));
  return rows.map((r) => ({ ...r, openRequest: byEvent.get(r.id) ?? null }));
}

export async function upcomingTurnos(patientId: string, limit = 10): Promise<PatientTurno[]> {
  const rows = await db
    .select(cols)
    .from(events)
    .where(and(eq(events.patientId, patientId), isNull(events.cancelledAt), gt(events.endsAt, new Date())))
    .orderBy(asc(events.startsAt))
    .limit(limit);
  return withRequests(rows);
}

export async function pastTurnos(patientId: string, limit = 10): Promise<PatientTurno[]> {
  const rows = await db
    .select(cols)
    .from(events)
    .where(and(eq(events.patientId, patientId), isNull(events.cancelledAt), lte(events.endsAt, new Date())))
    .orderBy(desc(events.startsAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, openRequest: null }));
}
