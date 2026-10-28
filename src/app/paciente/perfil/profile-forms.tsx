"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { changePassword, updatePhone, updateReminders, type ProfileFormState } from "./actions";

function Ok({ state }: { state: ProfileFormState }) {
  if (!state?.ok) return null;
  return (
    <p role="status" className="rounded-xl bg-verde-claro px-3.5 py-2.5 text-sm font-bold text-verde-oscuro">
      {state.ok}
    </p>
  );
}

export function PhoneForm({ phone }: { phone: string }) {
  const [state, action] = useActionState(updatePhone, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field
        label="Celular"
        name="phone"
        type="tel"
        autoComplete="tel"
        required={false}
        defaultValue={state?.values?.phone ?? phone}
        hint="Es opcional. Lo usa el consultorio para comunicarse con vos."
      />
      <FormError message={state?.error} />
      <Ok state={state} />
      <SubmitButton>Guardar celular</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Contraseña actual" name="current" type="password" autoComplete="current-password" />
      <Field
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Al menos 10 caracteres."
      />
      <Field label="Repetir contraseña nueva" name="confirm" type="password" autoComplete="new-password" />
      <FormError message={state?.error} />
      <Ok state={state} />
      <SubmitButton>Cambiar contraseña</SubmitButton>
    </form>
  );
}

export type Reminders = { remindEmail: boolean; remindPush: boolean; remind24h: boolean; remind2h: boolean };

function Check({ name, label, hint, checked }: { name: string; label: string; hint?: string; checked: boolean }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl px-1 py-2">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-6 w-6 shrink-0 accent-verde" />
      <span>
        <span className="block text-[15px] font-extrabold">{label}</span>
        {hint ? <span className="block text-[13px] font-semibold text-suave">{hint}</span> : null}
      </span>
    </label>
  );
}

export function RemindersForm({ reminders }: { reminders: Reminders }) {
  const [state, action] = useActionState(updateReminders, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-extrabold text-suave">¿Cómo querés recibirlos?</legend>
        <Check name="remindEmail" label="Por email" checked={reminders.remindEmail} />
        <Check
          name="remindPush"
          label="Notificación en el dispositivo"
          hint="Se activa desde cada dispositivo cuando esté disponible."
          checked={reminders.remindPush}
        />
      </fieldset>
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-extrabold text-suave">¿Cuándo?</legend>
        <Check name="remind24h" label="24 horas antes del turno" checked={reminders.remind24h} />
        <Check name="remind2h" label="2 horas antes del turno" checked={reminders.remind2h} />
      </fieldset>
      <p className="text-[13px] font-semibold text-suave">
        Los recordatorios solo indican día, hora y lugar del turno.
      </p>
      <Ok state={state} />
      <SubmitButton>Guardar preferencias</SubmitButton>
    </form>
  );
}
