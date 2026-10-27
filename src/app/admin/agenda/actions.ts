"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { and, eq, gte, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { events, users } from "@/db/schema";
import { findConflict, getEvent } from "@/lib/agenda";
import {
  addDays,
  dateToHm,
  dateToYmd,
  formatLong,
  isHm,
  isWeekday,
  isYmd,
  localToDate,
  todayYmd,
  weeklyOccurrences,
} from "@/lib/dates";
import { requireUser } from "@/lib/session";

export type EventFormState = { error?: string; values?: Record<string, string> } | undefined;

const REPEAT_OPTIONS = [0, 4, 8, 12, 26];
const FIELDS = ["kind", "id", "patientId", "title", "date", "start", "end", "duration", "location", "repeat", "note"];

function typed(formData: FormData) {
  return Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

function isOverlapViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23P01" || err?.cause?.code === "23P01";
}

const OVERLAP_MSG = "Ese horario se superpone con otro evento de la agenda.";

export async function saveEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireUser("admin");
  const values = typed(formData);
  const fail = (error: string): EventFormState => ({ error, values });

  const kindP = z.enum(["appointment", "other"]).safeParse(formData.get("kind"));
  if (!kindP.success) return fail("Tipo de evento inválido.");
  const kind = kindP.data;

  const idRaw = String(formData.get("id") ?? "");
  const editing = idRaw !== "";
  if (editing && !z.string().uuid().safeParse(idRaw).success) return fail("Evento no encontrado.");

  const date = String(formData.get("date") ?? "");
  const start = String(formData.get("start") ?? "");
  if (!isYmd(date)) return fail("Elegí una fecha válida.");
  if (!isHm(start)) return fail("Elegí una hora de inicio válida.");
  if (!isWeekday(date)) return fail("Por ahora la agenda es de lunes a viernes.");
  if (date < "2020-01-01" || date > addDays(todayYmd(), 1095)) return fail("La fecha está fuera de rango.");

  const loc = text(200).safeParse(formData.get("location"));
  const note = text(2000).safeParse(formData.get("note"));
  if (!loc.success) return fail("El lugar es demasiado largo.");
  if (!note.success) return fail("La nota es demasiado larga.");

  // Fin del evento: las citas usan duración; los otros eventos, hora de fin.
  let endHm: string;
  let title: string | null = null;
  let patientId: string | null = null;

  if (kind === "appointment") {
    const duration = Number(formData.get("duration"));
    if (!Number.isInteger(duration) || duration < 10 || duration > 240) return fail("Elegí una duración válida.");
    const end = new Date(localToDate(date, start).getTime() + duration * 60000);
    if (dateToYmd(end) !== date) return fail("La cita tiene que terminar el mismo día.");
    endHm = dateToHm(end);
    if (!editing) {
      const pid = z.string().uuid().safeParse(formData.get("patientId"));
      if (!pid.success) return fail("Elegí un paciente.");
      const [patient] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, pid.data), eq(users.role, "patient"), eq(users.active, true)))
        .limit(1);
      if (!patient) return fail("El paciente no existe o está inactivo.");
      patientId = patient.id;
    }
  } else {
    const t = z.string().trim().min(1, "Escribí un título.").max(120).safeParse(formData.get("title"));
    if (!t.success) return fail(t.error.issues[0]?.message ?? "Título inválido.");
    title = t.data;
    const end = String(formData.get("end") ?? "");
    if (!isHm(end)) return fail("Elegí una hora de fin válida.");
    if (end <= start) return fail("La hora de fin tiene que ser posterior a la de inicio.");
    endHm = end;
  }

  if (editing) {
    const current = await getEvent(idRaw);
    if (!current || current.cancelledAt) return fail("El evento no existe o ya fue cancelado.");
    if (current.kind !== kind) return fail("Tipo de evento inválido.");
    const startsAt = localToDate(date, start);
    const endsAt = localToDate(date, endHm);
    const conflict = await findConflict([{ start: startsAt, end: endsAt }], idRaw);
    if (conflict) return fail(conflictMessage(conflict));
    try {
      await db
        .update(events)
        .set({
          startsAt,
          endsAt,
          location: loc.data,
          privateNote: note.data,
          ...(kind === "other" ? { title } : {}),
          // Si cambia el horario, el paciente tiene que volver a confirmar.
          ...(startsAt.getTime() !== current.startsAt.getTime() ? { confirmedAt: null } : {}),
        })
        .where(and(eq(events.id, idRaw), isNull(events.cancelledAt)));
    } catch (e) {
      if (isOverlapViolation(e)) return fail(OVERLAP_MSG);
      throw e;
    }
    redirect(`/admin?fecha=${date}`);
  }

  const repeat = Number(formData.get("repeat") ?? 0);
  if (!REPEAT_OPTIONS.includes(repeat)) return fail("Repetición inválida.");
  const occurrences = weeklyOccurrences(date, start, endHm, Math.max(repeat, 1));
  const conflict = await findConflict(occurrences.map((o) => ({ start: o.start, end: o.end })));
  if (conflict) {
    return fail(
      repeat > 1
        ? `No se puede repetir: ${conflictMessage(conflict)}`
        : conflictMessage(conflict),
    );
  }

  const seriesId = repeat > 1 ? randomUUID() : null;
  try {
    await db.insert(events).values(
      occurrences.map((o) => ({
        kind,
        patientId,
        title,
        startsAt: o.start,
        endsAt: o.end,
        location: loc.data,
        privateNote: note.data,
        seriesId,
      })),
    );
  } catch (e) {
    if (isOverlapViolation(e)) return fail(OVERLAP_MSG);
    throw e;
  }
  redirect(`/admin?fecha=${date}`);
}

function conflictMessage(c: { title: string; startsAt: Date; endsAt: Date }) {
  const day = formatLong(dateToYmd(c.startsAt));
  return `Ese horario se superpone con «${c.title}» (${day}, de ${dateToHm(c.startsAt)} a ${dateToHm(c.endsAt)}).`;
}

export async function cancelEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Evento no encontrado." };
  const event = await getEvent(id.data);
  if (!event || event.cancelledAt) return { error: "El evento no existe o ya fue cancelado." };

  const following = formData.get("scope") === "following" && event.seriesId;
  const now = new Date();
  if (following) {
    await db
      .update(events)
      .set({ cancelledAt: now })
      .where(
        and(eq(events.seriesId, event.seriesId!), gte(events.startsAt, event.startsAt), isNull(events.cancelledAt)),
      );
  } else {
    await db.update(events).set({ cancelledAt: now }).where(eq(events.id, id.data));
  }
  redirect(`/admin?fecha=${dateToYmd(event.startsAt)}`);
}
