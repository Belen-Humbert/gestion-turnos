import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CancelForm, EventForm } from "@/components/agenda/event-form";
import { eventTone } from "@/components/agenda/styles";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { WhatsAppReminder } from "@/components/whatsapp-reminder";
import { getEvent } from "@/lib/agenda";
import { dateToHm, dateToYmd, formatLong, isUpcoming, minutesBetween } from "@/lib/dates";
import { openRequestForEvent } from "@/lib/requests";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Evento" };

export default async function EventPage({ params }: PageProps<"/admin/agenda/[id]">) {
  await requireUser("admin");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const event = await getEvent(id);
  if (!event || event.cancelledAt) notFound();

  const date = dateToYmd(event.startsAt);
  const request = await openRequestForEvent(event.id);
  const [patientRow] = event.patientId
    ? await db.select({ phone: users.phone }).from(users).where(eq(users.id, event.patientId)).limit(1)
    : [];
  const patientPhone = patientRow?.phone ?? null;
  const tone = eventTone(event);
  const isAppointment = event.kind === "appointment";
  const isFuture = isUpcoming(event.startsAt);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Link href={`/admin?fecha=${date}`} className="text-sm font-extrabold text-verde underline">
        ← Volver a la agenda
      </Link>

      <header className={`rounded-[18px] border-l-4 px-5 py-4 ${tone.box}`}>
        <p className="text-xs font-extrabold uppercase tracking-wide">{tone.label}</p>
        <h1 className="mt-0.5 text-2xl font-extrabold">{event.title}</h1>
        <p className="text-[15px] font-bold first-letter:uppercase">
          {formatLong(date)} · {dateToHm(event.startsAt)} a {dateToHm(event.endsAt)}
        </p>
        {isAppointment && event.patientId ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link href={`/admin/pacientes/${event.patientId}`} className="text-sm font-extrabold underline">
              Ver perfil del paciente
            </Link>
            {isFuture ? (
              <WhatsAppReminder
                phone={patientPhone}
                name={event.title}
                startsAt={event.startsAt}
                location={event.location}
              />
            ) : null}
          </div>
        ) : null}
      </header>

      {request ? (
        <section
          aria-label="Pedido de cambio"
          className="rounded-[18px] border-l-4 border-[#c8940a] bg-amarillo px-5 py-4"
        >
          <p className="text-xs font-extrabold uppercase tracking-wide text-[#5e3f00]">Pedido de cambio del paciente</p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] font-semibold">{request.message}</p>
          <p className="mt-1 text-xs font-bold text-[#5e3f00]">
            Al cambiar el horario, el pedido se marca como atendido.
          </p>
        </section>
      ) : null}

      <EventForm
        defaults={{
          id: event.id,
          kind: event.kind,
          patientName: isAppointment ? event.title : undefined,
          title: isAppointment ? undefined : event.title,
          date,
          start: dateToHm(event.startsAt),
          end: dateToHm(event.endsAt),
          duration: minutesBetween(event.startsAt, event.endsAt),
          location: event.location ?? "",
          note: event.privateNote ?? "",
        }}
      />

      <section aria-label="Cancelar" className="rounded-[22px] border border-borde bg-white p-6">
        <h2 className="mb-1 text-lg font-extrabold">{isAppointment ? "Cancelar cita" : "Eliminar evento"}</h2>
        <p className="mb-4 text-sm font-semibold text-suave">El horario queda libre en la agenda.</p>
        <CancelForm
          id={event.id}
          inSeries={Boolean(event.seriesId)}
          label={isAppointment ? "Cancelar cita" : "Eliminar evento"}
        />
      </section>
    </div>
  );
}
