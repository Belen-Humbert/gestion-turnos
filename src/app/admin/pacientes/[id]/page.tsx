import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StatusBadge } from "@/components/status-badge";
import { getPatient } from "@/lib/patients";
import { requireUser } from "@/lib/session";
import { ActiveToggle, EditPatientForm, InvitationSection } from "./patient-forms";

export const metadata: Metadata = { title: "Paciente" };

const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });

export default async function PatientPage({ params }: PageProps<"/admin/pacientes/[id]">) {
  await requireUser("admin");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const patient = await getPatient(id);
  if (!patient) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/admin/pacientes" className="text-sm font-extrabold text-verde underline">
        ← Volver a pacientes
      </Link>

      <header className="flex flex-wrap items-center gap-3.5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violeta text-2xl font-extrabold text-violeta-texto">
          {patient.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-extrabold">{patient.name}</h1>
          <p className="text-[13px] font-semibold text-suave">
            Cargado el {dateFmt.format(patient.createdAt)}
          </p>
        </div>
        <StatusBadge status={patient.status} />
      </header>

      <section aria-label="Datos del paciente" className="rounded-[22px] border border-borde bg-white p-6">
        <h2 className="mb-4 text-lg font-extrabold">Datos</h2>
        <EditPatientForm patient={patient} />
      </section>

      {patient.active ? (
        <section aria-label="Invitación" className="rounded-[22px] border border-borde bg-white p-6">
          <h2 className="text-lg font-extrabold">
            {patient.status === "invited" ? "Invitación" : "Acceso a la aplicación"}
          </h2>
          <p className="mb-4 mt-1 text-sm font-semibold text-suave">
            {patient.status === "invited"
              ? "Todavía no creó su contraseña. Podés generar un link nuevo para enviárselo."
              : "Si olvidó su contraseña, generá un link nuevo para que cree otra."}
          </p>
          <InvitationSection patientId={patient.id} resetting={patient.status === "active"} />
        </section>
      ) : null}

      <section aria-label="Estado" className="rounded-[22px] border border-borde bg-white p-6">
        <h2 className="text-lg font-extrabold">{patient.active ? "Desactivar paciente" : "Paciente inactivo"}</h2>
        <p className="mb-4 mt-1 text-sm font-semibold text-suave">
          {patient.active
            ? "Deja de poder ingresar y se cierran sus sesiones. Su historial se conserva y podés reactivarlo cuando quieras."
            : "No puede ingresar. Su historial se conserva. Al reactivarlo, generá un link nuevo para que vuelva a entrar."}
        </p>
        <ActiveToggle patientId={patient.id} active={patient.active} name={patient.name} />
      </section>
    </div>
  );
}
