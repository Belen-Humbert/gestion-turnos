import "server-only";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { events, patientNotes } from "@/db/schema";

export type NoteItem = {
  key: string;
  // "note" = escrita en el perfil; "event" = nota privada de una cita del calendario.
  source: "note" | "event";
  noteId?: string;
  eventId?: string;
  body: string;
  date: Date;
};

// Todas las notas de un paciente, de la más nueva a la más vieja. Solo para la administradora.
export async function listPatientNotes(patientId: string): Promise<NoteItem[]> {
  const [own, fromEvents] = await Promise.all([
    db.select().from(patientNotes).where(eq(patientNotes.patientId, patientId)).orderBy(desc(patientNotes.createdAt)),
    db
      .select({ id: events.id, body: events.privateNote, startsAt: events.startsAt })
      .from(events)
      .where(
        and(
          eq(events.patientId, patientId),
          isNull(events.cancelledAt),
          isNotNull(events.privateNote),
        ),
      )
      .orderBy(desc(events.startsAt)),
  ]);
  const items: NoteItem[] = [
    ...own.map((n) => ({ key: `n-${n.id}`, source: "note" as const, noteId: n.id, body: n.body, date: n.createdAt })),
    ...fromEvents.map((e) => ({ key: `e-${e.id}`, source: "event" as const, eventId: e.id, body: e.body ?? "", date: e.startsAt })),
  ];
  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}
