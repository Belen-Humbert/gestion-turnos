"use client";

import { CoinIcon } from "@/components/icons";
import { PaymentButtons } from "./payment-buttons";

export type PendingTurno = { id: string; label: string };

// Aviso al agendar: el paciente elegido tiene turnos anteriores sin pagar.
export function PendingPaymentNotice({ name, turnos }: { name: string; turnos: PendingTurno[] }) {
  if (turnos.length === 0) return null;
  return (
    <section
      aria-label="Pagos pendientes del paciente"
      className="flex flex-col gap-3 rounded-[18px] border-l-4 border-[#c58a00] bg-amarillo px-5 py-4 text-[#5e3f00]"
    >
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
        <CoinIcon size={20} />
        {turnos.length === 1
          ? `El turno anterior de ${name} quedó sin pagar`
          : `${name} tiene ${turnos.length} turnos anteriores sin pagar`}
      </h2>
      <ul className="flex flex-col gap-3">
        {turnos.map((t) => (
          <li key={t.id} className="flex flex-col gap-1.5">
            <span className="text-sm font-bold first-letter:uppercase">{t.label}</span>
            <PaymentButtons eventId={t.id} status="pending" />
          </li>
        ))}
      </ul>
      <p className="text-xs font-bold">Podés agendar igual: es solo un recordatorio.</p>
    </section>
  );
}
