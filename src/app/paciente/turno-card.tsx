"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/form-bits";
import { confirmAttendance, requestChange } from "./actions";

export type TurnoView = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  location: string | null;
  confirmed: boolean;
  request: { message: string; sentLabel: string } | null;
};

export function TurnoCard({ turno, highlight = false }: { turno: TurnoView; highlight?: boolean }) {
  const [confirmState, confirmAction] = useActionState(confirmAttendance, undefined);
  const [changeState, changeAction] = useActionState(requestChange, undefined);
  const requested = Boolean(turno.request) || Boolean(changeState?.ok);

  return (
    <article
      aria-label={`Turno ${turno.dateLabel}`}
      className={`rounded-[22px] border bg-white p-6 ${highlight ? "border-verde" : "border-borde"}`}
    >
      <p className="text-xs font-extrabold uppercase tracking-wide text-suave">{highlight ? "Tu próximo turno" : "Turno"}</p>
      <h2 className="mt-1 text-2xl font-extrabold first-letter:uppercase">{turno.dateLabel}</h2>
      <p className="text-lg font-bold">{turno.timeLabel}</p>
      {turno.location ? <p className="mt-1 text-[15px] font-semibold text-suave">{turno.location}</p> : null}

      <div className="mt-4">
        {turno.confirmed || confirmState?.ok ? (
          <p className="inline-block rounded-full bg-verde-claro px-3 py-1 text-sm font-extrabold text-verde-oscuro">
            ✓ Asistencia confirmada
          </p>
        ) : (
          <form action={confirmAction} className="flex flex-col gap-2">
            <input type="hidden" name="eventId" value={turno.id} />
            <FormError message={confirmState?.error} />
            <SubmitButton>Confirmar asistencia</SubmitButton>
          </form>
        )}
      </div>

      <div className="mt-4 border-t border-borde pt-4">
        {requested ? (
          <p role="status" className="rounded-xl bg-amarillo px-3.5 py-2.5 text-sm font-bold text-[#5e3f00]">
            Enviaste un pedido de cambio{turno.request ? ` el ${turno.request.sentLabel}` : ""}. Te van a responder a la brevedad.
          </p>
        ) : (
          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-extrabold text-verde underline">
              Necesito cambiar este turno
            </summary>
            <form action={changeAction} className="mt-2 flex flex-col gap-3">
              <input type="hidden" name="eventId" value={turno.id} />
              <label htmlFor={`msg-${turno.id}`} className="text-sm font-extrabold">
                Tu mensaje
              </label>
              <textarea
                id={`msg-${turno.id}`}
                name="message"
                rows={3}
                required
                maxLength={500}
                placeholder="Ej.: No voy a poder asistir ese día. ¿Podemos coordinar otro horario?"
                className="rounded-xl border-[1.5px] border-borde bg-white px-3.5 py-2.5 text-[15px] font-semibold"
              />
              <p className="text-[13px] font-semibold text-suave">
                No cambia el turno: se envía el aviso y te responden con un nuevo horario.
              </p>
              <FormError message={changeState?.error} />
              <SubmitButton>Enviar mensaje</SubmitButton>
            </form>
          </details>
        )}
      </div>
    </article>
  );
}
