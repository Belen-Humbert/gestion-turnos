"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { createInvitation, invitationUrl } from "@/lib/invitations";
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

const patientSchema = z.object({
  name: z.string().trim().min(2, "Escribí el nombre del paciente.").max(120),
  email: z.string().trim().toLowerCase().email("El email no es válido.").max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+()\-\s]*$/, "El teléfono solo puede tener números, espacios, + y guiones.")
    .optional()
    .transform((v) => v || null),
});

const idSchema = z.string().uuid();

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
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
    const [patient] = await db.insert(users).values({ role: "patient", name, email, phone }).returning();
    const token = await createInvitation(patient.id);
    revalidatePath("/admin/pacientes");
    return { patientId: patient.id, invite: buildInvite(name, phone, token) };
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Ya existe una persona con ese email.", values: typed(formData) };
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
      .set(parsed.data)
      .where(and(eq(users.id, id.data), eq(users.role, "patient")))
      .returning({ id: users.id });
    if (updated.length === 0) return { error: "Paciente no encontrado." };
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Ya existe una persona con ese email.", values: typed(formData) };
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
  if (!patient.active) return { error: "El paciente está inactivo. Reactivalo antes de invitarlo." };
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
  return { ok: active ? "Paciente reactivado." : "Paciente desactivado. Su historial se conserva." };
}
