import { dateToHm, dateToYmd, formatLong, todayYmd } from "./dates";
import type { ReminderKind } from "./reminder-rules";

// Texto neutro: solo día, hora y lugar. Sin datos clínicos ni mención al motivo del turno,
// porque un aviso puede verse en una pantalla bloqueada o en una bandeja compartida.
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function whenLabel(startsAt: Date, kind: ReminderKind): string {
  const day = formatLong(dateToYmd(startsAt));
  const hm = dateToHm(startsAt);
  return kind === "2h" ? `hoy a las ${hm}` : `mañana (${day}) a las ${hm}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export type ReminderInput = { name: string; startsAt: Date; location: string | null; kind: ReminderKind };

export function emailContent(input: ReminderInput & { appUrl: string }) {
  const when = whenLabel(input.startsAt, input.kind);
  const where = input.location ? ` Lugar: ${input.location}.` : "";
  const link = `${input.appUrl.replace(/\/$/, "")}/paciente`;
  const subject = `Recordatorio de turno: ${input.kind === "2h" ? "hoy" : "mañana"} a las ${dateToHm(input.startsAt)}`;
  const text =
    `Hola ${firstName(input.name)},\n\n` +
    `Te recordamos tu turno: ${when}.${where}\n\n` +
    `Podés confirmar tu asistencia o ver tus turnos acá: ${link}\n\n` +
    `Si ya lo confirmaste, no hace falta que hagas nada. Podés cambiar estos avisos en Perfil → Recordatorios.\n`;
  const html =
    `<p>Hola ${esc(firstName(input.name))},</p>` +
    `<p>Te recordamos tu turno: <strong>${esc(when)}</strong>.${esc(where)}</p>` +
    `<p><a href="${esc(link)}">Confirmar asistencia o ver mis turnos</a></p>` +
    `<p style="color:#5b6b66;font-size:13px">Si ya lo confirmaste, no hace falta que hagas nada. Podés cambiar estos avisos en Perfil → Recordatorios.</p>`;
  return { subject, text, html };
}

export function pushContent(input: ReminderInput) {
  const day = input.kind === "2h" ? "Hoy" : "Mañana";
  const where = input.location ? ` · ${input.location}` : "";
  return { title: "Recordatorio de turno", body: `${day} a las ${dateToHm(input.startsAt)}${where}`, url: "/paciente" };
}

// Mensaje que arma el botón manual de WhatsApp. Nunca se envía solo.
export function whatsappReminderText(input: { name: string; startsAt: Date; location: string | null }): string {
  const ymd = dateToYmd(input.startsAt);
  const day = ymd === todayYmd() ? "hoy" : `el ${formatLong(ymd)}`;
  const where = input.location ? ` (${input.location})` : "";
  return `Hola ${firstName(input.name)}, te recuerdo tu turno ${day} a las ${dateToHm(input.startsAt)}${where}. ¡Hasta pronto!`;
}
