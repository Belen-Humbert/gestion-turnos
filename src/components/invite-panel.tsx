"use client";

import { useState } from "react";
import type { Invite } from "@/app/admin/pacientes/actions";

// Muestra el link de invitación (solo se ve ahora: en la base se guarda únicamente su hash).
// El botón de WhatsApp solo abre el chat con el mensaje escrito; Ana lo envía ella misma.
export function InvitePanel({ invite }: { invite: Invite }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(invite.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Si el navegador no deja copiar, queda el campo para copiar a mano.
    }
  }

  return (
    <section
      aria-label="Link de invitación"
      className="flex flex-col gap-3 rounded-[18px] border border-borde bg-verde-claro p-4"
    >
      <h2 className="text-base font-extrabold text-verde-oscuro">Link de invitación para {invite.name}</h2>
      <p className="text-sm font-semibold text-verde-oscuro">
        Enviáselo para que cree su contraseña. Vale 7 días y se usa una sola vez. Después de salir de esta
        pantalla no se puede volver a ver; si hace falta, generás uno nuevo.
      </p>
      <input
        readOnly
        value={invite.url}
        aria-label="Link de invitación"
        onFocus={(e) => e.currentTarget.select()}
        className="h-12 rounded-xl border-[1.5px] border-borde bg-white px-3.5 text-sm font-semibold"
      />
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={copy}
          className="min-h-12 rounded-xl bg-verde px-5 text-sm font-extrabold text-white hover:bg-verde-oscuro"
        >
          {copied ? "¡Copiado!" : "Copiar link"}
        </button>
        {invite.whatsappUrl ? (
          <a
            href={invite.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center rounded-xl border-[1.5px] border-verde bg-white px-5 text-sm font-extrabold text-verde-oscuro"
          >
            Abrir WhatsApp con el mensaje
          </a>
        ) : (
          <span className="flex min-h-12 items-center text-sm font-semibold text-suave">
            Cargá un celular válido para usar el botón de WhatsApp.
          </span>
        )}
      </div>
    </section>
  );
}
