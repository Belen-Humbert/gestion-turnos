import { addDays, dateToHm, dateToYmd, formatLong, todayYmd } from "./dates";

// Texto neutro: solo día, hora y lugar. Sin datos clínicos ni mención al motivo del turno,
// porque un aviso puede verse en una pantalla bloqueada o en una bandeja compartida.
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

// El día se dice según la fecha real y el momento del envío, no según el tipo de aviso: un aviso
// "de 24 h" que sale después de medianoche es para hoy, y uno de "2 h" nunca debería decir "mañana".
function dayWord(startsAt: Date, now: Date): string {
  const ymd = dateToYmd(startsAt);
  const today = todayYmd(now);
  if (ymd === today) return "hoy";
  if (ymd === addDays(today, 1)) return "mañana";
  return `el ${formatLong(ymd)}`;
}

export function whenLabel(startsAt: Date, now: Date): string {
  const word = dayWord(startsAt, now);
  const hm = dateToHm(startsAt);
  return word === "mañana" ? `mañana (${formatLong(dateToYmd(startsAt))}) a las ${hm}` : `${word} a las ${hm}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export type ReminderInput = { name: string; startsAt: Date; location: string | null; now: Date };

export function emailContent(input: ReminderInput & { appUrl: string }) {
  const when = whenLabel(input.startsAt, input.now);
  const where = input.location ? ` Lugar: ${input.location}.` : "";
  const link = `${input.appUrl.replace(/\/$/, "")}/paciente`;
  const subject = `Recordatorio de turno: ${dayWord(input.startsAt, input.now)} a las ${dateToHm(input.startsAt)}`;
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
  const word = dayWord(input.startsAt, input.now);
  const day = word.charAt(0).toUpperCase() + word.slice(1);
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
