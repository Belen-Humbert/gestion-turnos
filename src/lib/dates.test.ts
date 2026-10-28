import { describe, expect, it } from "vitest";
import {
  addDays,
  dateToHm,
  dateToYmd,
  isHm,
  isYmd,
  localToDate,
  mondayOf,
  snapToWeekday,
  stepWeekday,
  weekdayIndex,
  addMonths,
  formatRange,
  lastOfMonth,
  monthWeeks,
  weeklyOccurrences,
} from "./dates";

describe("validaciones", () => {
  it("reconoce fechas y horas válidas", () => {
    expect(isYmd("2026-10-27")).toBe(true);
    expect(isYmd("2026-02-30")).toBe(false);
    expect(isYmd("27/10/2026")).toBe(false);
    expect(isHm("09:30")).toBe(true);
    expect(isHm("24:00")).toBe(false);
    expect(isHm("9:30")).toBe(false);
  });
});

describe("hora de Argentina", () => {
  it("convierte ida y vuelta", () => {
    const d = localToDate("2026-10-27", "09:30");
    expect(d.toISOString()).toBe("2026-10-27T12:30:00.000Z");
    expect(dateToYmd(d)).toBe("2026-10-27");
    expect(dateToHm(d)).toBe("09:30");
  });
  it("una cita nocturna no cambia de día", () => {
    const d = localToDate("2026-10-27", "22:30");
    expect(dateToYmd(d)).toBe("2026-10-27");
    expect(dateToHm(d)).toBe("22:30");
  });
});

describe("días de la semana", () => {
  it("calcula lunes y días hábiles", () => {
    expect(weekdayIndex("2026-10-26")).toBe(0); // lunes
    expect(weekdayIndex("2026-10-31")).toBe(5); // sábado
    expect(mondayOf("2026-10-30")).toBe("2026-10-26");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("salta los fines de semana", () => {
    expect(snapToWeekday("2026-10-31")).toBe("2026-11-02");
    expect(snapToWeekday("2026-11-01")).toBe("2026-11-02");
    expect(snapToWeekday("2026-10-28")).toBe("2026-10-28");
    expect(stepWeekday("2026-10-30", 1)).toBe("2026-11-02");
    expect(stepWeekday("2026-11-02", -1)).toBe("2026-10-30");
  });
});

describe("repetición semanal", () => {
  it("genera la misma hora cada semana, también al cruzar de mes", () => {
    const occ = weeklyOccurrences("2026-10-27", "10:00", "10:50", 3);
    expect(occ.map((o) => o.ymd)).toEqual(["2026-10-27", "2026-11-03", "2026-11-10"]);
    expect(occ.every((o) => dateToHm(o.start) === "10:00" && dateToHm(o.end) === "10:50")).toBe(true);
  });
});

describe("formatRange", () => {
  it("resume la semana", () => {
    expect(formatRange("2026-10-26", "2026-10-30")).toBe("26 al 30 de octubre de 2026");
    expect(formatRange("2026-10-26", "2026-11-02")).toBe("26 de octubre al 2 de noviembre de 2026");
  });
});

describe("mes", () => {
  it("calcula fin de mes y meses vecinos", () => {
    expect(lastOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(lastOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(addMonths("2026-10-27", 1)).toBe("2026-11-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
    expect(addMonths("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("arma las semanas hábiles del mes", () => {
    const weeks = monthWeeks("2026-10-27");
    expect(weeks[0]).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(weeks.at(-1)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
    expect(weeks).toHaveLength(5);
  });
  it("no agrega una semana que cae solo en fin de semana", () => {
    // 1 de noviembre de 2026 es domingo: la semana del 26 al 30 de octubre no pertenece a noviembre.
    const weeks = monthWeeks("2026-11-15");
    expect(weeks[0][0]).toBe("2026-11-02");
    expect(weeks.every((w) => w.some((d) => d.startsWith("2026-11")))).toBe(true);
  });
});
