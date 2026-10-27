import Link from "next/link";
import type { AgendaEvent } from "@/lib/agenda";
import { addDays, dateToHm, dateToYmd, formatLong, formatShort, mondayOf, todayYmd } from "@/lib/dates";
import { eventTone } from "./styles";

const HOUR_PX = 56;

const formatDay = (e: AgendaEvent) => dateToYmd(e.startsAt);
const toMin = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));

function EventBlock({ e, startMin }: { e: AgendaEvent; startMin: number }) {
  const s = toMin(dateToHm(e.startsAt));
  const en = toMin(dateToHm(e.endsAt));
  const tone = eventTone(e);
  const height = Math.max(((en - s) / 60) * HOUR_PX, 26);
  return (
    <Link
      href={`/admin/agenda/${e.id}`}
      style={{ top: ((s - startMin) / 60) * HOUR_PX, height }}
      className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-xs font-bold leading-tight hover:brightness-95 ${tone.box}`}
      title={`${e.title} · ${dateToHm(e.startsAt)} a ${dateToHm(e.endsAt)} · ${tone.label}`}
    >
      <span className="block truncate font-extrabold">{e.title}</span>
      <span className="block truncate font-semibold opacity-80">
        {dateToHm(e.startsAt)} – {dateToHm(e.endsAt)}
      </span>
    </Link>
  );
}

function Grid({ days, events, view }: { days: string[]; events: AgendaEvent[]; view: "semana" | "dia" }) {
  const today = todayYmd();
  // La grilla va de 8 a 20 y se estira si hay eventos fuera de ese horario.
  const mins = events.flatMap((e) => [toMin(dateToHm(e.startsAt)), toMin(dateToHm(e.endsAt))]);
  const startHour = Math.min(8, mins.length ? Math.floor(Math.min(...mins) / 60) : 8);
  const endHour = Math.max(20, mins.length ? Math.ceil(Math.max(...mins) / 60) : 20);
  const startMin = startHour * 60;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = hours.length * HOUR_PX;

  return (
    <div
      className={`${view === "semana" ? "hidden md:block" : ""} overflow-x-auto rounded-[18px] border border-borde bg-white`}
    >
      <div className="min-w-[560px]">
        <div className="flex border-b border-borde">
          <div className="w-14 shrink-0" />
          {days.map((d) => (
            <Link
              key={d}
              href={`/admin?vista=dia&fecha=${d}`}
              className={`flex-1 border-l border-borde px-2 py-2.5 text-center text-sm font-extrabold first-letter:uppercase hover:bg-fondo ${
                d === today ? "text-verde" : ""
              }`}
            >
              {formatShort(d)}
              {d === today ? <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-verde align-middle" /> : null}
            </Link>
          ))}
        </div>
        <div className="flex" style={{ height }}>
          <div className="relative w-14 shrink-0">
            {hours.map((h) => (
              <span
                key={h}
                style={{ top: (h - startHour) * HOUR_PX - 8 }}
                className="absolute right-2 text-xs font-bold text-suave"
              >
                {h > startHour ? `${String(h).padStart(2, "0")}:00` : ""}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div
              key={d}
              className="relative flex-1 border-l border-borde"
              style={{
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, #dce5e1 ${HOUR_PX - 1}px, #dce5e1 ${HOUR_PX}px)`,
              }}
            >
              {events
                .filter((e) => formatDay(e) === d)
                .map((e) => (
                  <EventBlock key={e.id} e={e} startMin={startMin} />
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Lista por día: es la vista de la semana en pantallas chicas.
function DayList({ days, events }: { days: string[]; events: AgendaEvent[] }) {
  const today = todayYmd();
  return (
    <div className="flex flex-col gap-4 md:hidden">
      {days.map((d) => {
        const list = events.filter((e) => formatDay(e) === d);
        return (
          <section key={d} aria-label={formatLong(d)}>
            <h2 className={`mb-2 text-base font-extrabold first-letter:uppercase ${d === today ? "text-verde" : ""}`}>
              <Link href={`/admin?vista=dia&fecha=${d}`}>{formatLong(d)}</Link>
            </h2>
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-borde px-3.5 py-3 text-sm font-semibold text-suave">
                Sin eventos
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.map((e) => {
                  const tone = eventTone(e);
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/admin/agenda/${e.id}`}
                        className={`flex min-h-14 items-center gap-3 rounded-xl border-l-4 px-3.5 py-2.5 ${tone.box}`}
                      >
                        <span className="w-24 shrink-0 text-sm font-extrabold">
                          {dateToHm(e.startsAt)} – {dateToHm(e.endsAt)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-extrabold">{e.title}</span>
                          <span className="block text-xs font-bold opacity-80">{tone.label}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function AgendaView({
  view,
  date,
  events,
}: {
  view: "semana" | "dia";
  date: string;
  events: AgendaEvent[];
}) {
  const monday = mondayOf(date);
  const days = view === "semana" ? [0, 1, 2, 3, 4].map((i) => addDays(monday, i)) : [date];
  return (
    <>
      <Grid days={days} events={events} view={view} />
      {view === "semana" ? <DayList days={days} events={events} /> : null}
    </>
  );
}
