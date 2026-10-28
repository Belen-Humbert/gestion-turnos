import type { Metadata } from "next";
import Link from "next/link";
import { dateToHm, dateToYmd, formatLong } from "@/lib/dates";
import { listOpenRequests, listResolvedRequests, type RequestRow } from "@/lib/requests";
import { requireUser } from "@/lib/session";
import { changeReplyMessage, whatsappLink } from "@/lib/whatsapp";
import { resolveRequest } from "./actions";

export const metadata: Metadata = { title: "Pedidos de cambio" };

const sentFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "numeric",
  month: "long",
  hour: "numeric",
  minute: "2-digit",
});

function turnoLabel(r: RequestRow) {
  return `${formatLong(dateToYmd(r.startsAt))} · ${dateToHm(r.startsAt)} a ${dateToHm(r.endsAt)}`;
}

export default async function RequestsPage() {
  await requireUser("admin");
  const [open, resolved] = await Promise.all([listOpenRequests(), listResolvedRequests()]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header>
        <h1 className="text-3xl font-extrabold">Pedidos de cambio</h1>
        <p className="mt-1 text-[15px] font-semibold text-suave">
          Los pacientes no pueden reprogramar: avisan con un mensaje y el administrador decide. Al reprogramar o
          cancelar la cita, el pedido se marca como atendido.
        </p>
      </header>

      {open.length === 0 ? (
        <p className="rounded-[22px] border border-borde bg-white p-6 text-[15px] font-semibold text-suave">
          No hay pedidos pendientes.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Pedidos pendientes">
          {open.map((r) => {
            const wa = whatsappLink(r.patientPhone, changeReplyMessage(r.patientName));
            return (
              <li key={r.id} className="rounded-[22px] border border-borde bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link href={`/admin/pacientes/${r.patientId}`} className="text-lg font-extrabold underline">
                    {r.patientName}
                  </Link>
                  <span className="text-xs font-bold text-suave">Enviado el {sentFmt.format(r.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-sm font-bold text-suave first-letter:uppercase">Turno: {turnoLabel(r)}</p>
                <p className="mt-3 whitespace-pre-wrap rounded-xl bg-fondo px-3.5 py-3 text-[15px] font-semibold leading-snug">
                  {r.message}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {r.eventCancelled ? null : (
                    <Link
                      href={`/admin/agenda/${r.eventId}`}
                      className="inline-flex min-h-11 items-center rounded-xl bg-verde px-4 text-sm font-extrabold text-white hover:bg-verde-oscuro"
                    >
                      Reprogramar
                    </Link>
                  )}
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center rounded-xl border-[1.5px] border-borde px-4 text-sm font-extrabold hover:bg-fondo"
                    >
                      Responder por WhatsApp
                    </a>
                  ) : null}
                  <form action={resolveRequest} className="ml-auto">
                    <input type="hidden" name="requestId" value={r.id} />
                    <button className="min-h-11 rounded-xl px-4 text-sm font-extrabold text-suave hover:bg-fondo">
                      Marcar como atendido
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {resolved.length > 0 ? (
        <details className="rounded-[22px] border border-borde bg-white p-5">
          <summary className="cursor-pointer text-sm font-extrabold">Atendidos recientemente ({resolved.length})</summary>
          <ul className="mt-3 flex flex-col gap-2">
            {resolved.map((r) => (
              <li key={r.id} className="rounded-xl bg-fondo px-3.5 py-2.5 text-sm font-semibold">
                <span className="font-extrabold">{r.patientName}</span> · <span className="first-letter:uppercase">{turnoLabel(r)}</span>
                <p className="mt-0.5 whitespace-pre-wrap text-suave">{r.message}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
