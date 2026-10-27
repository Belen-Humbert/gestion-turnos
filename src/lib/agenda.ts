import "server-only";
import { and, asc, eq, gt, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, users } from "@/db/schema";
import { localToDate } from "./dates";

export type AgendaEvent = {
  id: string;
  kind: "appointment" | "other";
  title: string;
  patientId: string | null;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  privateNote: string | null;
  confirmedAt: Date | null;
  seriesId: string | null;
};

const columns = {
  id: events.id,
  kind: events.kind,
  // Para las citas, el título es el nombre del paciente.
  title: sql<string>`coalesce(${users.name}, ${events.title})`,
  patientId: events.patientId,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  location: events.location,
  privateNote: events.privateNote,
  confirmedAt: events.confirmedAt,
  seriesId: events.seriesId,
};

// Eventos activos que tocan el rango [startYmd, endYmd) en hora de Argentina.
export async function listEventsBetween(startYmd: string, endYmd: string): Promise<AgendaEvent[]> {
  const from = localToDate(startYmd, "00:00");
  const to = localToDate(endYmd, "00:00");
  return db
    .select(columns)
    .from(events)
    .leftJoin(users, eq(users.id, events.patientId))
    .where(and(isNull(events.cancelledAt), lt(events.startsAt, to), gt(events.endsAt, from)))
    .orderBy(asc(events.startsAt));
}

export async function getEvent(id: string): Promise<(AgendaEvent & { cancelledAt: Date | null }) | null> {
  const [row] = await db
    .select({ ...columns, cancelledAt: events.cancelledAt })
    .from(events)
    .leftJoin(users, eq(users.id, events.patientId))
    .where(eq(events.id, id))
    .limit(1);
  return row ?? null;
}

export async function listBookablePatients() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.role, "patient"), eq(users.active, true)))
    .orderBy(asc(sql`lower(${users.name})`));
}

// Devuelve el primer evento activo que se superpone con alguno de los rangos.
export async function findConflict(ranges: { start: Date; end: Date }[], excludeId?: string) {
  if (ranges.length === 0) return null;
  const overlap = or(...ranges.map((r) => and(lt(events.startsAt, r.end), gt(events.endsAt, r.start))))!;
  const [row] = await db
    .select({ title: columns.title, startsAt: events.startsAt, endsAt: events.endsAt })
    .from(events)
    .leftJoin(users, eq(users.id, events.patientId))
    .where(and(isNull(events.cancelledAt), overlap, excludeId ? ne(events.id, excludeId) : undefined))
    .orderBy(asc(events.startsAt))
    .limit(1);
  return row ?? null;
}

export async function upcomingAppointments(patientId: string, limit = 5): Promise<AgendaEvent[]> {
  return db
    .select(columns)
    .from(events)
    .leftJoin(users, eq(users.id, events.patientId))
    .where(
      and(
        eq(events.patientId, patientId),
        isNull(events.cancelledAt),
        gt(events.endsAt, new Date()),
      ),
    )
    .orderBy(asc(events.startsAt))
    .limit(limit);
}
