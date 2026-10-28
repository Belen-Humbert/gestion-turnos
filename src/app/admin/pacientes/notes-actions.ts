"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { patientNotes, users } from "@/db/schema";
import { requireUser } from "@/lib/session";

export type NoteFormState = { error?: string; ok?: string } | undefined;

const idSchema = z.string().uuid();
const bodySchema = z.string().trim().min(1, "Escribí la nota.").max(4000, "La nota es demasiado larga.");

export async function addNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  await requireUser("admin");
  const patientId = idSchema.safeParse(formData.get("patientId"));
  if (!patientId.success) return { error: "Paciente no encontrado." };
  const body = bodySchema.safeParse(formData.get("body"));
  if (!body.success) return { error: body.error.issues[0]?.message ?? "Nota inválida." };

  const [patient] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, patientId.data), eq(users.role, "patient")))
    .limit(1);
  if (!patient) return { error: "Paciente no encontrado." };

  await db.insert(patientNotes).values({ patientId: patient.id, body: body.data });
  revalidatePath(`/admin/pacientes/${patient.id}`);
  return { ok: "Nota guardada." };
}

export async function deleteNote(_prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  await requireUser("admin");
  const id = idSchema.safeParse(formData.get("noteId"));
  if (!id.success) return { error: "Nota no encontrada." };
  const deleted = await db.delete(patientNotes).where(eq(patientNotes.id, id.data)).returning({ patientId: patientNotes.patientId });
  if (deleted.length === 0) return { error: "La nota ya no existe." };
  revalidatePath(`/admin/pacientes/${deleted[0].patientId}`);
  return { ok: "Nota borrada." };
}
