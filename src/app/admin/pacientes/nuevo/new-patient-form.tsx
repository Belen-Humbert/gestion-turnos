"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { InvitePanel } from "@/components/invite-panel";
import { createPatient } from "../actions";

export function NewPatientForm() {
  const [state, action] = useActionState(createPatient, undefined);

  if (state?.invite) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-xl bg-verde-claro px-4 py-3 text-sm font-extrabold text-verde-oscuro">
          Paciente creado.
        </p>
        <InvitePanel invite={state.invite} />
        <div className="flex flex-wrap gap-2.5">
          <Link
            href={`/admin/pacientes/${state.patientId}`}
            className="flex min-h-12 items-center rounded-xl bg-verde px-5 text-sm font-extrabold text-white hover:bg-verde-oscuro"
          >
            Ver perfil
          </Link>
          <Link
            href="/admin/pacientes/nuevo"
            className="flex min-h-12 items-center rounded-xl border-[1.5px] border-borde bg-white px-5 text-sm font-extrabold"
          >
            Agregar otro
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-[22px] border border-borde bg-white p-6">
      <Field label="Nombre y apellido" name="name" autoComplete="off" defaultValue={state?.values?.name} />
      <Field label="Email" name="email" type="email" autoComplete="off" defaultValue={state?.values?.email} />
      <Field
        label="Celular (opcional)"
        name="phone"
        type="tel"
        autoComplete="off"
        required={false}
        defaultValue={state?.values?.phone}
        hint="Con código de área, por ejemplo 261 555 0123. Se usa para el botón de WhatsApp."
      />
      <FormError message={state?.error} />
      <SubmitButton>Guardar y generar invitación</SubmitButton>
    </form>
  );
}
