import type { Metadata } from "next";
import { AgendaToolbar, type AgendaViewName } from "@/components/agenda/agenda-toolbar";
import { AgendaView } from "@/components/agenda/agenda-view";
import { MonthView } from "@/components/agenda/month-view";
import { listEventsBetween } from "@/lib/agenda";
import { addDays, isYmd, lastOfMonth, mondayOf, todayYmd } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/admin">) {
  await requireUser("admin");
  const sp = await searchParams;
  const view: AgendaViewName = sp.vista === "dia" ? "dia" : sp.vista === "mes" ? "mes" : "semana";
  const fecha = typeof sp.fecha === "string" && isYmd(sp.fecha) ? sp.fecha : todayYmd();
  const date = fecha;

  let from: string;
  let to: string;
  if (view === "mes") {
    const first = `${date.slice(0, 7)}-01`;
    from = mondayOf(first);
    to = addDays(mondayOf(lastOfMonth(first)), 7);
  } else if (view === "semana") {
    from = mondayOf(date);
    to = addDays(from, 7);
  } else {
    from = date;
    to = addDays(from, 1);
  }
  const events = await listEventsBetween(from, to);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <AgendaToolbar view={view} date={date} />
      {view === "mes" ? (
        <MonthView date={date} events={events} />
      ) : (
        <AgendaView view={view} date={date} events={events} />
      )}
    </div>
  );
}
