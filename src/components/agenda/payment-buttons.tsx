"use client";

import { useActionState } from "react";
import { setPayment } from "@/app/admin/agenda/actions";
import { PAYMENT_SHORT, type PaymentStatus } from "@/lib/payments";

const OPTIONS: PaymentStatus[] = ["cash", "transfer", "pending"];

// Tres botones: efectivo, transferencia o pendiente. El elegido queda marcado.
export function PaymentButtons({
  eventId,
  status,
  label = "Pago del turno",
}: {
  eventId: string;
  status: PaymentStatus;
  label?: string;
}) {
  const [state, action] = useActionState(setPayment, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={eventId} />
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => {
          const on = status === o;
          return (
            <button
              key={o}
              type="submit"
              name="status"
              value={o}
              aria-pressed={on}
              className={`min-h-11 rounded-xl px-4 text-sm font-extrabold ${
                on
                  ? o === "pending"
                    ? "bg-amarillo text-[#5e3f00] ring-2 ring-[#c58a00]"
                    : "bg-verde text-white"
                  : "border-[1.5px] border-borde bg-white text-[#44524d] hover:bg-fondo"
              }`}
            >
              {o === "pending" ? "Pendiente" : `Pagó ${PAYMENT_SHORT[o].toLowerCase()}`}
            </button>
          );
        })}
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm font-bold text-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
