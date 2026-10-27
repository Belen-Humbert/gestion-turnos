import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/agenda/event-form";
import { isYmd, snapToWeekday, todayYmd } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Otro evento" };

export default async function NewOtherEventPage({ searchParams }: PageProps<"/admin/agenda/evento/nuevo">) {
  await requireUser("admin");
  const sp = await searchParams;
  const fecha = typeof sp.fecha === "string" && isYmd(sp.fecha) ? sp.fecha : todayYmd();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Link href={`/admin?fecha=${fecha}`} className="text-sm font-extrabold text-verde underline">
        ← Volver a la agenda
      </Link>
      <header>
        <h1 className="text-3xl font-extrabold">Otro evento</h1>
        <p className="mt-1 text-[15px] font-semibold text-suave">
          Para clases, compromisos y todo lo que no es una cita. No se avisa a ningún paciente.
        </p>
      </header>
      <EventForm defaults={{ kind: "other", date: snapToWeekday(fecha), start: "11:00", end: "13:00" }} />
    </div>
  );
}
