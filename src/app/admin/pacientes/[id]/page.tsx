import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StatusBadge } from "@/components/status-badge";
import { pastAppointments, upcomingAppointments } from "@/lib/agenda";
import { CoinIcon } from "@/components/icons";
import { PAYMENT_LABEL } from "@/lib/payments";
import { dateToHm, dateToYmd, formatLong } from "@/lib/dates";
import { listPatientNotes } from "@/lib/notes";
import { getPatient } from "@/lib/patients";
import { requireUser } from "@/lib/session";
import { NotesSection } from "./notes";
import { WhatsAppReminder } from "@/components/whatsapp-reminder";
import { ActiveToggle, DischargeToggle, EditPatientForm, InvitationSection } from "./patient-forms";

export const metadata: Metadata = { title: "Paciente" };

const noteDate = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" });
const dateFmt = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeZone: "America/Argentina/Buenos_Aires" });

export default async function PatientPage({ params }: PageProps<"/admin/pacientes/[id]">) {
  await requireUser("admin");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const patient = await getPatient(id);
  if (!patient) notFound();
  const notes = (await listPatientNotes(patient.id)).map((n) => ({
    key: n.key,
    source: n.source,
    noteId: n.noteId,
    eventId: n.eventId,
    body: n.body,
    dateLabel: noteDate.format(n.date),
  }));
  const upcoming = patient.active ? await upcomingAppointments(patient.id) : [];
  const discharged = patient.status === "discharged";
  const past = await pastAppointments(patient.id, 12);
  const owed = past.filter((t) => t.paymentStatus === "pending").length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/admin/pacientes" className="text-sm font-extrabold text-verde underline">
        ← Volver a pacientes
      </Link>

      <header className="flex flex-wrap items-center gap-3.5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violeta text-2xl font-extrabold text-violeta-texto">
          {patient.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-extrabold">{patient.name}</h1>
          <p className="text-[13px] font-semibold text-suave">
            Cargado el {dateFmt.format(patient.createdAt)}
          </p>
        </div>
        <StatusBadge status={patient.status} />
      </header>

      {patient.active && !discharged ? (
        <section aria-label="Próximos turnos" className="rounded-[22px] border border-borde bg-white p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold">Próximos turnos</h2>
            <Link
              href={`/admin/agenda/cita/nueva?paciente=${patient.id}`}
              className="flex min-h-11 items-center rounded-xl bg-verde px-4 text-sm font-extrabold text-white hover:bg-verde-oscuro"
            >
              Agregar cita
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm font-semibold text-suave">No tiene turnos cargados.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/agenda/${e.id}`}
                    className={`flex min-h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-[15px] font-extrabold ${
                      e.confirmedAt ? "bg-verde-claro text-verde-oscuro" : "bg-amarillo text-[#5e3f00]"
                    }`}
                  >
                    <span className="first-letter:uppercase">
                      {formatLong(dateToYmd(e.startsAt))} · {dateToHm(e.startsAt)}
                    </span>
                    <span className="text-xs">{e.confirmedAt ? "Confirmado" : "Sin confirmar"}</span>
                  </Link>
                  <WhatsAppReminder phone={patient.phone} name={patient.name} startsAt={e.startsAt} location={e.location} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {past.length > 0 ? (
        <section aria-label="Pagos" className="rounded-[22px] border border-borde bg-white p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <span aria-hidden className="text-verde">
                <CoinIcon size={22} />
              </span>
              Pagos
            </h2>
            {owed > 0 ? (
              <span className="rounded-full bg-amarillo px-3 py-1 text-xs font-extrabold text-[#5e3f00]">
                {owed} {owed === 1 ? "turno sin pagar" : "turnos sin pagar"}
              </span>
            ) : (
              <span className="rounded-full bg-verde-claro px-3 py-1 text-xs font-extrabold text-verde-oscuro">Al día</span>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {past.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/agenda/${t.id}`}
                  className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-3.5 py-2 text-[15px] font-bold ${
                    t.paymentStatus === "pending" ? "bg-amarillo text-[#5e3f00]" : "bg-fondo"
                  }`}
                >
                  <span className="first-letter:uppercase">
                    {formatLong(dateToYmd(t.startsAt))} · {dateToHm(t.startsAt)}
                  </span>
                  <span className="text-xs font-extrabold">{PAYMENT_LABEL[t.paymentStatus]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <NotesSection patientId={patient.id} notes={notes} />

      <section aria-label="Datos del paciente" className="rounded-[22px] border border-borde bg-white p-6">
        <h2 className="mb-4 text-lg font-extrabold">Datos</h2>
        <EditPatientForm patient={patient} />
      </section>

      {patient.active ? (
        <section aria-label="Invitación" className="rounded-[22px] border border-borde bg-white p-6">
          <h2 className="text-lg font-extrabold">
            {patient.status === "invited" ? "Invitación" : "Acceso a la aplicación"}
          </h2>
          <p className="mb-4 mt-1 text-sm font-semibold text-suave">
            {patient.status === "invited"
              ? "Todavía no creó su contraseña. Generá el link y mandáselo por WhatsApp."
              : "Si olvidó su contraseña, generá un link nuevo para que cree otra."}
          </p>
          <InvitationSection patientId={patient.id} resetting={patient.status === "active"} />
        </section>
      ) : null}

      {patient.active ? (
        <section aria-label="Alta" className="rounded-[22px] border border-borde bg-white p-6">
          <h2 className="text-lg font-extrabold">{discharged ? "Paciente dado de alta" : "Dar de alta"}</h2>
          <p className="mb-4 mt-1 text-sm font-semibold text-suave">
            {discharged
              ? "Terminó su tratamiento. Conserva su cuenta y puede seguir en la Biblioteca, el Foro y la Comunidad, pero no se le agendan turnos."
              : "Cuando termina el tratamiento. Conserva su cuenta para seguir participando en la Biblioteca, el Foro y la Comunidad; ya no se le agendan turnos."}
          </p>
          <DischargeToggle patientId={patient.id} discharged={discharged} name={patient.name} futureTurnos={upcoming.length} />
        </section>
      ) : null}

      <section aria-label="Acceso" className="rounded-[22px] border border-borde bg-white p-6">
        <h2 className="text-lg font-extrabold">{patient.active ? "Bloquear acceso" : "Acceso bloqueado"}</h2>
        <p className="mb-4 mt-1 text-sm font-semibold text-suave">
          {patient.active
            ? "Para casos puntuales: deja de poder ingresar a la aplicación y se cierran sus sesiones. Su historial se conserva."
            : "No puede ingresar. Su historial se conserva. Al desbloquearlo, generá un link nuevo para que vuelva a entrar."}
        </p>
        <ActiveToggle patientId={patient.id} active={patient.active} name={patient.name} />
      </section>
    </div>
  );
}
