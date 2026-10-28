"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { changeRequests, events } from "@/db/schema";
import { requireUser } from "@/lib/session";

export type TurnoFormState = { error?: string; ok?: string } | undefined;

const idSchema = z.string().uuid();
const messageSchema = z.string().trim().min(1, "Escribí un mensaje.").max(500, "El mensaje es demasiado largo (máximo 500 caracteres).");

// Devuelve la cita solo si es del paciente, no está cancelada y todavía no pasó.
async function ownUpcoming(patientId: string, raw: unknown) {
  const id = idSchema.safeParse(raw);
  if (!id.success) return null;
  const [row] = await db
    .select({ id: events.id, confirmedAt: events.confirmedAt })
    .from(events)
    .where(
      and(
        eq(events.id, id.data),
        eq(events.patientId, patientId),
        isNull(events.cancelledAt),
        gt(events.endsAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function confirmAttendance(_prev: TurnoFormState, formData: FormData): Promise<TurnoFormState> {
  const user = await requireUser("patient");
  const turno = await ownUpcoming(user.id, formData.get("eventId"));
  if (!turno) return { error: "No encontramos ese turno." };
  if (!turno.confirmedAt) {
    await db.update(events).set({ confirmedAt: new Date() }).where(eq(events.id, turno.id));
  }
  revalidatePath("/paciente", "layout");
  return { ok: "Asistencia confirmada." };
}

export async function requestChange(_prev: TurnoFormState, formData: FormData): Promise<TurnoFormState> {
  const user = await requireUser("patient");
  const message = messageSchema.safeParse(formData.get("message"));
  if (!message.success) return { error: message.error.issues[0]?.message ?? "Mensaje inválido." };
  const turno = await ownUpcoming(user.id, formData.get("eventId"));
  if (!turno) return { error: "No encontramos ese turno." };
  try {
    await db.insert(changeRequests).values({ eventId: turno.id, patientId: user.id, message: message.data });
  } catch (e) {
    // Índice único: ya hay un pedido abierto para esta cita.
    if ((e as { code?: string }).code === "23505" || (e as { cause?: { code?: string } }).cause?.code === "23505") {
      return { error: "Ya enviaste un pedido para este turno. Te van a responder a la brevedad." };
    }
    throw e;
  }
  revalidatePath("/paciente", "layout");
  revalidatePath("/admin", "layout");
  return { ok: "Mensaje enviado." };
}
