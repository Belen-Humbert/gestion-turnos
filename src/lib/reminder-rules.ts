// Cuándo corresponde enviar cada recordatorio. Función pura: no toca la base ni el reloj.
export type ReminderKind = "24h" | "2h";

const HOUR = 60 * 60 * 1000;
export const LEAD_MS: Record<ReminderKind, number> = { "24h": 24 * HOUR, "2h": 2 * HOUR };
// Tolerancia si el proceso que envía tarda en correr (o estuvo caído un rato).
// Pasada la tolerancia, el aviso se descarta: un "recordatorio" tarde confunde más de lo que ayuda.
export const GRACE_MS: Record<ReminderKind, number> = { "24h": 3 * HOUR, "2h": 1 * HOUR };

export const KINDS: ReminderKind[] = ["24h", "2h"];

// Un recordatorio vence cuando falta el tiempo indicado, dentro de la tolerancia, y solo si la
// cita ya existía antes de que se abriera esa ventana (si se agendó con menos de 24 h de
// anticipación, el paciente recién la vio y no corresponde el aviso de 24 h).
export function dueKinds(startsAt: Date, createdAt: Date, now: Date): ReminderKind[] {
  if (now.getTime() >= startsAt.getTime()) return [];
  return KINDS.filter((kind) => {
    const opens = startsAt.getTime() - LEAD_MS[kind];
    return now.getTime() >= opens && now.getTime() < opens + GRACE_MS[kind] && createdAt.getTime() <= opens;
  });
}
