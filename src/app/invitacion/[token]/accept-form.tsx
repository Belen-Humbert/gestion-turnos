"use client";

import { useActionState } from "react";
import { acceptInvitation } from "@/app/actions";
import { Field, FormError, SubmitButton } from "@/components/form-bits";

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(acceptInvitation, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      {/* Ayuda a los gestores de contraseñas a asociar la cuenta. */}
      <input type="email" value={email} autoComplete="username" readOnly hidden />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="Al menos 10 caracteres."
      />
      <Field label="Repetir contraseña" name="confirm" type="password" autoComplete="new-password" />
      <FormError message={state?.error} />
      <SubmitButton>Crear contraseña y entrar</SubmitButton>
    </form>
  );
}
