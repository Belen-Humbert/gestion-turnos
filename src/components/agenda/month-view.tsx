import Link from "next/link";
import type { AgendaEvent } from "@/lib/agenda";
import { dateToHm, dateToYmd, formatLong, monthWeeks, todayYmd } from "@/lib/dates";
import { eventTone } from "./styles";

const MAX_CHIPS = 3;
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie"];

const DOT: Record<string, string> = {
  "Otro evento": "bg-azul-texto",
  Confirmada: "bg-verde",
  "Sin confirmar": "bg-[#c58a00]",
};

// Mes completo de lunes a viernes. Cada día lleva a la vista del día; en el celular los
// eventos se resumen con puntos de color para que entren.
export function MonthView({ date, events }: { date: string; events: AgendaEvent[] }) {
  const weeks = monthWeeks(date);
  const month = date.slice(0, 7);
  const today = todayYmd();
  const byDay = new Map<string, AgendaEvent[]>();
  for (const e of events) {
    const d = dateToYmd(e.startsAt);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-borde bg-white">
      <div className="grid grid-cols-5 border-b border-borde">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2.5 text-center text-sm font-extrabold">
            {w}
          </div>
        ))}
      </div>
      <div role="grid" aria-label="Mes" className="grid grid-cols-5">
        {weeks.flat().map((d) => {
          const inMonth = d.startsWith(month);
          const list = byDay.get(d) ?? [];
          const extra = list.length - MAX_CHIPS;
          return (
            <div
              key={d}
              role="gridcell"
              className={`relative min-h-[72px] border-b border-l border-borde first:border-l-0 md:min-h-[116px] [&:nth-child(5n+1)]:border-l-0 ${
                inMonth ? "" : "bg-fondo/70"
              }`}
            >
              <Link
                href={`/admin?vista=dia&fecha=${d}`}
                aria-label={`${formatLong(d)}${list.length ? `, ${list.length} ${list.length === 1 ? "evento" : "eventos"}` : ""}`}
                className="absolute inset-0 hover:bg-verde-claro/40"
              />
              <div className="pointer-events-none relative flex flex-col gap-1 p-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold ${
                    d === today ? "bg-verde text-white" : inMonth ? "" : "text-suave"
                  }`}
                >
                  {Number(d.slice(8))}
                </span>

                <ul className="hidden flex-col gap-1 md:flex">
                  {list.slice(0, MAX_CHIPS).map((e) => {
                    const tone = eventTone(e);
                    return (
                      <li key={e.id}>
                        <Link
                          href={`/admin/agenda/${e.id}`}
                          title={`${e.title} · ${dateToHm(e.startsAt)} a ${dateToHm(e.endsAt)} · ${tone.label}`}
                          className={`pointer-events-auto relative block truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-xs font-bold hover:brightness-95 ${tone.box}`}
                        >
                          {dateToHm(e.startsAt)} {e.title}
                        </Link>
                      </li>
                    );
                  })}
                  {extra > 0 ? (
                    <li className="px-1 text-xs font-extrabold text-suave">+{extra} más</li>
                  ) : null}
                </ul>

                {list.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1 md:hidden" aria-hidden="true">
                    {list.slice(0, 4).map((e) => (
                      <span key={e.id} className={`h-2 w-2 rounded-full ${DOT[eventTone(e).label]}`} />
                    ))}
                    {list.length > 4 ? <span className="text-[10px] font-extrabold text-suave">+{list.length - 4}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
