"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { InvitePanel } from "@/components/invite-panel";
import { newInvitation, setPatientActive, updatePatient } from "../actions";

export function EditPatientForm({
  patient,
}: {
  patient: { id: string; name: string; email: string; phone: string | null };
}) {
  const [state, action] = useActionState(updatePatient, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={patient.id} />
      <Field label="Nombre y apellido" name="name" autoComplete="off" defaultValue={state?.values?.name ?? patient.name} />
      <Field label="Email" name="email" type="email" autoComplete="off" defaultValue={state?.values?.email ?? patient.email} />
      <Field
        label="Celular (opcional)"
        name="phone"
        type="tel"
        autoComplete="off"
        required={false}
        defaultValue={state?.values?.phone ?? patient.phone ?? ""}
        hint="Con código de área, por ejemplo 261 555 0123."
      />
      <FormError message={state?.error} />
      {state?.ok ? (
        <p role="status" className="rounded-xl bg-verde-claro px-3.5 py-2.5 text-sm font-extrabold text-verde-oscuro">
          {state.ok}
        </p>
      ) : null}
      <SubmitButton>Guardar cambios</SubmitButton>
    </form>
  );
}

export function InvitationSection({ patientId, resetting }: { patientId: string; resetting: boolean }) {
  const [state, action] = useActionState(newInvitation, undefined);
  return (
    <div className="flex flex-col gap-4">
      <form action={action}>
        <input type="hidden" name="id" value={patientId} />
        <button
          type="submit"
          className="min-h-12 rounded-xl border-[1.5px] border-verde bg-white px-5 text-sm font-extrabold text-verde-oscuro hover:bg-verde-claro"
        >
          {resetting ? "Generar link para nueva contraseña" : "Generar link de invitación"}
        </button>
      </form>
      <FormError message={state?.error} />
      {state?.invite ? <InvitePanel invite={state.invite} /> : null}
    </div>
  );
}

export function ActiveToggle({ patientId, active, name }: { patientId: string; active: boolean; name: string }) {
  const [state, action] = useActionState(setPatientActive, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (active && !window.confirm(`¿Desactivar a ${name}? Se cerrarán sus sesiones.`)) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={patientId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <FormError message={state?.error} />
      {state?.ok ? (
        <p role="status" className="rounded-xl bg-verde-claro px-3.5 py-2.5 text-sm font-extrabold text-verde-oscuro">
          {state.ok}
        </p>
      ) : null}
      <button
        type="submit"
        className={`min-h-12 w-fit rounded-xl px-5 text-sm font-extrabold ${
          active ? "border-[1.5px] border-error bg-white text-error hover:bg-[#fbe9e9]" : "bg-verde text-white hover:bg-verde-oscuro"
        }`}
      >
        {active ? "Desactivar paciente" : "Reactivar paciente"}
      </button>
    </form>
  );
}
