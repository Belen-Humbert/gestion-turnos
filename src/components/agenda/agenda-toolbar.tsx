import Link from "next/link";
import {
  addDays,
  addMonths,
  formatLong,
  formatMonth,
  formatRange,
  mondayOf,
  snapToWeekday,
  stepWeekday,
  todayYmd,
} from "@/lib/dates";

export type AgendaViewName = "semana" | "dia" | "mes";

export function AgendaToolbar({ view, date }: { view: AgendaViewName; date: string }) {
  const monday = mondayOf(date);
  const prev = view === "mes" ? addMonths(date, -1) : view === "semana" ? addDays(monday, -7) : stepWeekday(date, -1);
  const next = view === "mes" ? addMonths(date, 1) : view === "semana" ? addDays(monday, 7) : stepWeekday(date, 1);
  const go = (d: string) => `/admin?vista=${view}&fecha=${d}`;
  const title = view === "mes" ? formatMonth(date) : view === "semana" ? formatRange(monday, addDays(monday, 4)) : formatLong(date);
  const unit = view === "mes" ? "Mes" : view === "semana" ? "Semana" : "Día";

  const btn =
    "flex min-h-11 items-center justify-center rounded-xl border-[1.5px] border-borde bg-white px-4 text-sm font-extrabold hover:bg-fondo";

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Agenda</h1>
          <p className="mt-1 text-[15px] font-semibold first-letter:uppercase text-suave">{title}</p>
        </div>
        <details className="relative">
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl bg-verde px-5 text-[15px] font-extrabold text-white hover:bg-verde-oscuro [&::-webkit-details-marker]:hidden">
            <span aria-hidden="true" className="text-xl leading-none">+</span> Agregar
          </summary>
          <div className="absolute right-0 z-10 mt-2 flex w-56 flex-col gap-1 rounded-2xl border border-borde bg-white p-2 shadow-lg">
            <Link
              href={`/admin/agenda/cita/nueva?fecha=${date}`}
              className="flex min-h-12 items-center rounded-xl px-3 text-[15px] font-extrabold hover:bg-verde-claro"
            >
              Agregar cita
            </Link>
            <Link
              href={`/admin/agenda/evento/nuevo?fecha=${date}`}
              className="flex min-h-12 items-center rounded-xl px-3 text-[15px] font-extrabold hover:bg-azul"
            >
              Otro evento
            </Link>
          </div>
        </details>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={go(prev)} className={btn} aria-label={`${unit} anterior`}>
          ←
        </Link>
        <Link href={go(snapToWeekday(todayYmd()))} className={btn}>
          Hoy
        </Link>
        <Link href={go(next)} className={btn} aria-label={`${unit} siguiente`}>
          →
        </Link>
        <nav aria-label="Vista" className="ml-auto flex gap-1.5">
          {(["semana", "dia", "mes"] as const).map((v) => (
            <Link
              key={v}
              href={`/admin?vista=${v}&fecha=${date}`}
              aria-current={view === v ? "true" : undefined}
              className={`flex min-h-11 items-center rounded-xl px-4 text-sm font-extrabold ${
                view === v ? "bg-verde text-white" : "border-[1.5px] border-borde bg-white hover:bg-fondo"
              }`}
            >
              {v === "semana" ? "Semana" : v === "dia" ? "Día" : "Mes"}
            </Link>
          ))}
        </nav>
      </div>

      <ul aria-label="Referencias" className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-bold text-suave">
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-verde-claro ring-1 ring-verde" /> Confirmada</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amarillo ring-1 ring-[#c58a00]" /> Sin confirmar</li>
        <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-azul ring-1 ring-azul-texto" /> Otro evento</li>
      </ul>
    </header>
  );
}
