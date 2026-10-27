import type { Metadata } from "next";
import Link from "next/link";
import { EventForm } from "@/components/agenda/event-form";
import { listBookablePatients } from "@/lib/agenda";
import { isHm, isYmd, snapToWeekday, todayYmd } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Agregar cita" };

export default async function NewAppointmentPage({ searchParams }: PageProps<"/admin/agenda/cita/nueva">) {
  await requireUser("admin");
  const sp = await searchParams;
  const patients = await listBookablePatients();
  const fecha = typeof sp.fecha === "string" && isYmd(sp.fecha) ? sp.fecha : todayYmd();
  const hora = typeof sp.hora === "string" && isHm(sp.hora) ? sp.hora : "10:00";
  const paciente = typeof sp.paciente === "string" ? sp.paciente : "";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Link href={`/admin?fecha=${fecha}`} className="text-sm font-extrabold text-verde underline">
        ← Volver a la agenda
      </Link>
      <header>
        <h1 className="text-3xl font-extrabold">Agregar cita</h1>
        <p className="mt-1 text-[15px] font-semibold text-suave">
          La sesión con un paciente. El horario no puede superponerse con otro evento.
        </p>
      </header>
      <EventForm
        patients={patients}
        defaults={{
          kind: "appointment",
          date: snapToWeekday(fecha),
          start: hora,
          duration: 50,
          patientId: patients.some((p) => p.id === paciente) ? paciente : "",
        }}
      />
    </div>
  );
}
