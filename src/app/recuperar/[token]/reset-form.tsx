"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { resetPassword } from "../actions";

export function ResetForm({ token, email }: { token: string; email: string | null }) {
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="email" value={email ?? ""} autoComplete="username" readOnly hidden />
      <Field label="Contraseña nueva" name="password" type="password" autoComplete="new-password" hint="Al menos 10 caracteres." />
      <Field label="Repetir contraseña" name="confirm" type="password" autoComplete="new-password" />
      <FormError message={state?.error} />
      <SubmitButton>Guardar contraseña</SubmitButton>
    </form>
  );
}
