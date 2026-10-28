import { dateToHm, dateToYmd, formatLong } from "@/lib/dates";
import type { PatientTurno } from "@/lib/patient-turnos";
import type { TurnoView } from "./turno-card";

const sentFmt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "numeric",
  month: "long",
});

export function toTurnoView(t: PatientTurno): TurnoView {
  return {
    id: t.id,
    dateLabel: formatLong(dateToYmd(t.startsAt)),
    timeLabel: `${dateToHm(t.startsAt)} a ${dateToHm(t.endsAt)}`,
    location: t.location,
    confirmed: Boolean(t.confirmedAt),
    request: t.openRequest ? { message: t.openRequest.message, sentLabel: sentFmt.format(t.openRequest.createdAt) } : null,
  };
}
