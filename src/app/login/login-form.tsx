"use client";

import { useActionState } from "react";
import { login } from "@/app/actions";
import { Field, FormError, SubmitButton } from "@/components/form-bits";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="username"
        defaultValue={state?.email}
      />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" />
      <FormError message={state?.error} />
      <SubmitButton>Ingresar</SubmitButton>
    </form>
  );
}
