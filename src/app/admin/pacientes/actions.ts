"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { createInvitation, invitationUrl } from "@/lib/invitations";
import { phoneKey } from "@/lib/phone";
import { deletePendingInvitations } from "@/lib/patients";
import { requireUser } from "@/lib/session";
import { invitationMessage, whatsappLink } from "@/lib/whatsapp";

export type Invite = { url: string; whatsappUrl: string | null; name: string };
type Values = { name: string; email: string; phone: string };
export type PatientFormState =
  | { error?: string; ok?: string; invite?: Invite; patientId?: string; values?: Values }
  | undefined;

// Devuelve lo que se escribió para que el formulario no quede vacío después de un error.
function typed(formData: FormData): Values {
  const get = (k: string) => String(formData.get(k) ?? "");
  return { name: get("name"), email: get("email"), phone: get("phone") };
}

// El celular es obligatorio (es como Ana se comunica con el paciente y, si no tiene email, con lo que ingresa).
// El email es opcional.
const patientSchema = z.object({
  name: z.string().trim().min(2, "Escribí el nombre del paciente.").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Escribí el celular del paciente.")
    .max(30)
    .regex(/^[0-9+()\-\s]*$/, "El celular solo puede tener números, espacios, + y guiones.")
    .refine((v) => phoneKey(v) !== null, "El celular tiene que llevar el código de área, por ejemplo 261 555 0123."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "El email no es válido.")
    .transform((v) => v || null),
});

const idSchema = z.string().uuid();

function uniqueViolation(e: unknown): string | null {
  const err = e as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = err?.code ?? err?.cause?.code;
  if (code !== "23505") return null;
  const constraint = err?.constraint ?? err?.cause?.constraint ?? "";
  return constraint.includes("phone") ? "Ya existe un paciente con ese celular." : "Ya existe una persona con ese email.";
}

function buildInvite(name: string, phone: string | null, token: string): Invite {
  const url = invitationUrl(token);
  return { url, name, whatsappUrl: whatsappLink(phone, invitationMessage(name, url)) };
}

export async function createPatient(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  await requireUser("admin");
  const parsed = patientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", values: typed(formData) };
  const { name, email, phone } = parsed.data;

  try {
    const [patient] = await db
      .insert(users)
      .values({ role: "patient", name, email, phone, phoneKey: phoneKey(phone) })
      .returning();
    const token = await createInvitation(patient.id);
    revalidatePath("/admin/pacientes");
    return { patientId: patient.id, invite: buildInvite(name, phone, token) };
  } catch (e) {
    const dup = uniqueViolation(e);
    if (dup) return { error: dup, values: typed(formData) };
    throw e;
  }
}

export async function updatePatient(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  await requireUser("admin");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "Paciente no encontrado." };
  const parsed = patientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", values: typed(formData) };

  try {
    const updated = await db
      .update(users)
      .set({ ...parsed.data, phoneKey: phoneKey(parsed.data.phone) })
      .where(and(eq(users.id, id.data), eq(users.role, "patient")))
      .returning({ id: users.id });
    if (updated.length === 0) return { error: "Paciente no encontrado." };
  } catch (e) {
    const dup = uniqueViolation(e);
    if (dup) return { error: dup, values: typed(formData) };
    throw e;
  }
  revalidatePath("/admin/pacientes");
  revalidatePath(`/admin/pacientes/${id.data}`);
  return { ok: "Datos guardados." };
}

// Genera un link nuevo (el anterior deja de servir). Sirve para reenviar la invitación
// o para que un paciente que olvidó su contraseña cree una nueva.
export async function newInvitation(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  await requireUser("admin");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "Paciente no encontrado." };
  const [patient] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id.data), eq(users.role, "patient")))
    .limit(1);
  if (!patient) return { error: "Paciente no encontrado." };
  if (!patient.active) return { error: "El paciente tiene el acceso bloqueado. Desbloquealo antes de invitarlo." };
  const token = await createInvitation(patient.id);
  return { invite: buildInvite(patient.name, patient.phone, token) };
}

export async function setPatientActive(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  await requireUser("admin");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "Paciente no encontrado." };
  const active = formData.get("active") === "true";

  const updated = await db
    .update(users)
    .set({ active })
    .where(and(eq(users.id, id.data), eq(users.role, "patient")))
    .returning({ id: users.id });
  if (updated.length === 0) return { error: "Paciente no encontrado." };

  if (!active) {
    // Al desactivar: se cierran sus sesiones y se anulan las invitaciones pendientes.
    await db.delete(sessions).where(eq(sessions.userId, id.data));
    await deletePendingInvitations(id.data);
  }
  revalidatePath("/admin/pacientes");
  revalidatePath(`/admin/pacientes/${id.data}`);
  return { ok: active ? "Acceso desbloqueado." : "Acceso bloqueado. Su historial se conserva." };
}

// Dar de alta: terminó el tratamiento. Conserva la cuenta (sigue en Biblioteca, Foro y Comunidad)
// pero ya no se le agendan turnos. Reabrir el tratamiento lo vuelve a dejar en tratamiento.
export async function setPatientDischarged(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  await requireUser("admin");
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "Paciente no encontrado." };
  const discharged = formData.get("discharged") === "true";
  const updated = await db
    .update(users)
    .set({ dischargedAt: discharged ? new Date() : null })
    .where(and(eq(users.id, id.data), eq(users.role, "patient")))
    .returning({ id: users.id });
  if (updated.length === 0) return { error: "Paciente no encontrado." };
  revalidatePath("/admin/pacientes");
  revalidatePath(`/admin/pacientes/${id.data}`);
  revalidatePath("/admin", "layout");
  return { ok: discharged ? "Paciente dado de alta. Conserva su cuenta." : "Tratamiento reabierto." };
}
