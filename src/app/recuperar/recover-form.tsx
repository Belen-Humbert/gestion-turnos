"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { requestReset } from "./actions";

export function RecoverForm() {
  const [state, action] = useActionState(requestReset, undefined);
  if (state?.sent) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="rounded-xl bg-verde-claro px-3.5 py-3 text-[15px] font-bold text-verde-oscuro">
          Si ese email tiene una cuenta, te mandamos un link para elegir una contraseña nueva. Revisá también la carpeta de spam. El link sirve por una hora.
        </p>
        <a href="/login" className="text-sm font-extrabold text-verde underline">Volver a ingresar</a>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Email" name="email" type="email" autoComplete="username" defaultValue={state?.email} />
      <FormError message={state?.error} />
      <p className="text-[13px] font-semibold text-suave">
        ¿No tenés email? Pedile a Ana un link nuevo por WhatsApp.
      </p>
      <SubmitButton>Enviarme el link</SubmitButton>
      <a href="/login" className="text-sm font-extrabold text-verde underline">Volver a ingresar</a>
    </form>
  );
}
