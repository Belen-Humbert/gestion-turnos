import type { Metadata } from "next";
import { AgendaToolbar } from "@/components/agenda/agenda-toolbar";
import { AgendaView } from "@/components/agenda/agenda-view";
import { listEventsBetween } from "@/lib/agenda";
import { addDays, isYmd, mondayOf, snapToWeekday, todayYmd } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/admin">) {
  await requireUser("admin");
  const sp = await searchParams;
  const view = sp.vista === "dia" ? "dia" : "semana";
  const fecha = typeof sp.fecha === "string" && isYmd(sp.fecha) ? sp.fecha : todayYmd();
  const date = snapToWeekday(fecha);

  const from = view === "semana" ? mondayOf(date) : date;
  const to = view === "semana" ? addDays(from, 5) : addDays(from, 1);
  const events = await listEventsBetween(from, to);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <AgendaToolbar view={view} date={date} />
      <AgendaView view={view} date={date} events={events} />
    </div>
  );
}
