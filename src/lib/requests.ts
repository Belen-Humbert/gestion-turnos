import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { changeRequests, events, users } from "@/db/schema";

export type RequestRow = {
  id: string;
  message: string;
  createdAt: Date;
  resolvedAt: Date | null;
  eventId: string;
  startsAt: Date;
  endsAt: Date;
  eventCancelled: boolean;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
};

const cols = {
  id: changeRequests.id,
  message: changeRequests.message,
  createdAt: changeRequests.createdAt,
  resolvedAt: changeRequests.resolvedAt,
  eventId: changeRequests.eventId,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  eventCancelled: sql<boolean>`${events.cancelledAt} is not null`,
  patientId: changeRequests.patientId,
  patientName: users.name,
  patientPhone: users.phone,
};

function base() {
  return db
    .select(cols)
    .from(changeRequests)
    .innerJoin(events, eq(events.id, changeRequests.eventId))
    .innerJoin(users, eq(users.id, changeRequests.patientId));
}

export function listOpenRequests(): Promise<RequestRow[]> {
  return base().where(isNull(changeRequests.resolvedAt)).orderBy(asc(changeRequests.createdAt));
}

export function listResolvedRequests(limit = 10): Promise<RequestRow[]> {
  return base().where(isNotNull(changeRequests.resolvedAt)).orderBy(desc(changeRequests.resolvedAt)).limit(limit);
}

export async function countOpenRequests(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(changeRequests).where(isNull(changeRequests.resolvedAt));
  return row?.n ?? 0;
}

export async function openRequestForEvent(eventId: string) {
  const [row] = await db
    .select({ id: changeRequests.id, message: changeRequests.message, createdAt: changeRequests.createdAt })
    .from(changeRequests)
    .where(and(eq(changeRequests.eventId, eventId), isNull(changeRequests.resolvedAt)))
    .limit(1);
  return row ?? null;
}

// Se llama cuando la administradora reprograma o cancela: el pedido ya está atendido.
export async function resolveRequestsForEvents(eventIds: string[]) {
  if (eventIds.length === 0) return;
  await db
    .update(changeRequests)
    .set({ resolvedAt: new Date() })
    .where(and(inArray(changeRequests.eventId, eventIds), isNull(changeRequests.resolvedAt)));
}
