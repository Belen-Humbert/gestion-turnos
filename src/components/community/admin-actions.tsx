"use client";

import { useActionState } from "react";
import { approvePost, removePost, renewPost, requestChanges } from "@/app/admin/comunidad/actions";
import { FormError } from "@/components/form-bits";

const btn = "min-h-11 rounded-xl px-4 text-sm font-extrabold transition";

export function ReviewActions({ id, status, expired }: { id: string; status: "pending" | "changes" | "approved"; expired: boolean }) {
  const [state, action, busy] = useActionState(requestChanges, undefined);
  return (
    <div className="flex flex-col gap-3 border-t border-borde pt-3">
      <div className="flex flex-wrap gap-2">
        {status !== "approved" ? (
          <form action={approvePost}>
            <input type="hidden" name="id" value={id} />
            <button className={`${btn} bg-verde text-white hover:bg-verde-oscuro`}>Aprobar y publicar</button>
          </form>
        ) : (
          <form action={renewPost}>
            <input type="hidden" name="id" value={id} />
            <button className={`${btn} border-[1.5px] border-verde bg-white text-verde-oscuro hover:bg-verde-claro`}>
              {expired ? "Volver a publicar un mes" : "Renovar un mes"}
            </button>
          </form>
        )}
        <form action={removePost}>
          <input type="hidden" name="id" value={id} />
          <button className={`${btn} border-[1.5px] border-borde bg-white hover:bg-fondo`}>Eliminar</button>
        </form>
      </div>
      {status !== "approved" ? (
        <form action={action} className="flex flex-col gap-2">
          <label htmlFor={`note-${id}`} className="text-sm font-extrabold">Pedir modificaciones</label>
          <textarea
            id={`note-${id}`}
            name="note"
            rows={2}
            maxLength={500}
            required
            placeholder="Contale qué tiene que cambiar para respetar las normas"
            className="rounded-xl border-[1.5px] border-borde bg-white px-3.5 py-2.5 text-[15px] font-semibold"
          />
          <input type="hidden" name="id" value={id} />
          <FormError message={state?.error} />
          {state?.ok ? <p role="status" className="text-sm font-bold text-verde-oscuro">{state.ok}</p> : null}
          <button disabled={busy} className={`${btn} w-fit border-[1.5px] border-borde bg-white hover:bg-fondo`}>Enviar pedido de cambios</button>
        </form>
      ) : null}
    </div>
  );
}
