import type { Metadata } from "next";
import { CalendarIcon, CheckCircleIcon, ClockIcon, CoinIcon } from "@/components/icons";
import { PAYMENT_SHORT } from "@/lib/payments";
import { dateToHm, dateToYmd, formatLong } from "@/lib/dates";
import { pastTurnos, upcomingTurnos } from "@/lib/patient-turnos";
import { requireUser } from "@/lib/session";
import { TurnoCard } from "../turno-card";
import { toTurnoView } from "../view";

export const metadata: Metadata = { title: "Turnos" };

export default async function Page() {
  const user = await requireUser("patient");
  const [upcoming, past] = await Promise.all([upcomingTurnos(user.id), pastTurnos(user.id, 24)]);
  const owed = past.filter((t) => t.paymentStatus === "pending").length;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Turnos</h1>
      <div className="grid items-start gap-5 md:grid-cols-2">
        {upcoming.length === 0 ? (
          <p className="rounded-[22px] border border-borde bg-white p-6 text-[15px] font-semibold text-suave">
            No tenés turnos próximos.
          </p>
        ) : (
          upcoming.map((t, i) => <TurnoCard key={t.id} turno={toTurnoView(t)} highlight={i === 0} />)
        )}
      </div>
      {past.length > 0 ? (
        <section aria-label="Turnos anteriores" className="rounded-[22px] border border-borde bg-white p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">Anteriores</h2>
            {owed > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amarillo px-3 py-1 text-sm font-extrabold text-[#5e3f00]">
                <CoinIcon size={17} /> {owed} {owed === 1 ? "turno pendiente de pago" : "turnos pendientes de pago"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-verde-claro px-3 py-1 text-sm font-extrabold text-verde-oscuro">
                <CheckCircleIcon size={17} /> Tus pagos están al día
              </span>
            )}
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((t) => {
              const paid = t.paymentStatus !== "pending";
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-xl bg-fondo px-3.5 py-3">
                  <span aria-hidden className="text-verde">
                    <CalendarIcon size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-extrabold first-letter:uppercase">{formatLong(dateToYmd(t.startsAt))}</span>
                    <span className="block text-sm font-semibold text-suave">{dateToHm(t.startsAt)}</span>
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${
                      paid ? "bg-verde-claro text-verde-oscuro" : "bg-amarillo text-[#5e3f00]"
                    }`}
                  >
                    {paid ? <CheckCircleIcon size={15} /> : <ClockIcon size={15} />}
                    {paid ? `Pagado · ${PAYMENT_SHORT[t.paymentStatus].toLowerCase()}` : "Pago pendiente"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
