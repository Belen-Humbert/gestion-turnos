import type { Metadata } from "next";
import { CalendarIcon } from "@/components/icons";
import { dateToHm, dateToYmd, formatLong } from "@/lib/dates";
import { pastTurnos, upcomingTurnos } from "@/lib/patient-turnos";
import { requireUser } from "@/lib/session";
import { TurnoCard } from "../turno-card";
import { toTurnoView } from "../view";

export const metadata: Metadata = { title: "Turnos" };

export default async function Page() {
  const user = await requireUser("patient");
  const [upcoming, past] = await Promise.all([upcomingTurnos(user.id), pastTurnos(user.id)]);
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
          <h2 className="mb-3 text-lg font-extrabold">Anteriores</h2>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl bg-fondo px-3.5 py-3">
                <span aria-hidden className="text-verde">
                  <CalendarIcon size={22} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-extrabold first-letter:uppercase">{formatLong(dateToYmd(t.startsAt))}</span>
                  <span className="block text-sm font-semibold text-suave">{dateToHm(t.startsAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
