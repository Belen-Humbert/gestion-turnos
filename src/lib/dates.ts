// Fechas de la agenda. Todo se guarda en UTC y se muestra en hora de Argentina.
// Argentina no usa horario de verano, así que el desfase es siempre -03:00.
export const TZ = "America/Argentina/Buenos_Aires";
const OFFSET = "-03:00";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isYmd(s: unknown): s is string {
  if (typeof s !== "string" || !YMD_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isHm(s: unknown): s is string {
  return typeof s === "string" && HM_RE.test(s);
}

// "2026-10-27" + "09:30" (hora de Argentina) -> instante UTC.
export function localToDate(ymd: string, hm: string): Date {
  return new Date(`${ymd}T${hm}:00${OFFSET}`);
}

const ymdFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function dateToYmd(d: Date): string {
  return ymdFmt.format(d);
}

export function dateToHm(d: Date): string {
  return hmFmt.format(d);
}

export function todayYmd(now: Date = new Date()): string {
  return dateToYmd(now);
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// 0 = lunes ... 6 = domingo.
export function weekdayIndex(ymd: string): number {
  return (new Date(`${ymd}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function isWeekday(ymd: string): boolean {
  return weekdayIndex(ymd) <= 4;
}

export function mondayOf(ymd: string): string {
  return addDays(ymd, -weekdayIndex(ymd));
}

// Sábado y domingo pasan al lunes siguiente (la agenda es de lunes a viernes).
export function snapToWeekday(ymd: string): string {
  const w = weekdayIndex(ymd);
  return w <= 4 ? ymd : addDays(ymd, 7 - w);
}

// Siguiente o anterior día hábil.
export function stepWeekday(ymd: string, dir: 1 | -1): string {
  let next = addDays(ymd, dir);
  while (!isWeekday(next)) next = addDays(next, dir);
  return next;
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

const longFmt = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const shortFmt = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "short", day: "numeric" });
const monthFmt = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", month: "long", year: "numeric" });

const at = (ymd: string) => new Date(`${ymd}T12:00:00Z`);
export const formatLong = (ymd: string) => longFmt.format(at(ymd));
export const formatShort = (ymd: string) => shortFmt.format(at(ymd)).replace(".", "");
export const formatMonth = (ymd: string) => monthFmt.format(at(ymd));

// Repetición semanal: la misma hora local, semana tras semana.
export function weeklyOccurrences(ymd: string, hmStart: string, hmEnd: string, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(ymd, 7 * i);
    return { ymd: day, start: localToDate(day, hmStart), end: localToDate(day, hmEnd) };
  });
}

const dayMonthFmt = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "numeric", month: "long" });
const dayOnlyFmt = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "numeric" });

// "26 al 30 de octubre de 2026" o "26 de octubre al 2 de noviembre de 2026".
export function formatRange(fromYmd: string, toYmd: string): string {
  const a = at(fromYmd);
  const b = at(toYmd);
  const year = toYmd.slice(0, 4);
  if (fromYmd.slice(0, 7) === toYmd.slice(0, 7)) {
    return `${dayOnlyFmt.format(a)} al ${dayMonthFmt.format(b)} de ${year}`;
  }
  return `${dayMonthFmt.format(a)} al ${dayMonthFmt.format(b)} de ${year}`;
}

export function lastOfMonth(ymd: string): string {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// Primer día del mes que está n meses después (o antes, si n es negativo).
export function addMonths(ymd: string, n: number): string {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}

// Semanas (lunes a viernes) que tocan el mes de la fecha dada.
export function monthWeeks(ymd: string): string[][] {
  const first = `${ymd.slice(0, 7)}-01`;
  const last = lastOfMonth(first);
  const weeks: string[][] = [];
  for (let monday = mondayOf(first); monday <= last; monday = addDays(monday, 7)) {
    const days = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
    if (days.some((d) => d >= first && d <= last)) weeks.push(days);
  }
  return weeks;
}

// Si el instante todavía no pasó. Va en una función aparte para no llamar al reloj dentro de un componente.
export function isUpcoming(d: Date): boolean {
  return d.getTime() > Date.now();
}

const dateTimeFmt = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);
export const formatDate = (d: Date) => dateFmt.format(d);
