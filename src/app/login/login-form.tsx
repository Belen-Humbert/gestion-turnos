"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions";
import { Field, FormError, SubmitButton } from "@/components/form-bits";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        label="Email o celular"
        name="email"
        type="text"
        autoComplete="username"
        hint="Si no usás email, escribí tu celular con código de área."
        defaultValue={state?.email}
      />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" />
      <FormError message={state?.error} />
      <SubmitButton>Ingresar</SubmitButton>
      <Link href="/recuperar" className="text-sm font-extrabold text-verde underline">¿Olvidaste tu contraseña?</Link>
    </form>
  );
}
