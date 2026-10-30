import { describe, expect, it } from "vitest";
import { emailContent, pushContent, whatsappReminderText, whenLabel } from "./reminder-messages";

// 2026-11-05 09:00 en Argentina (UTC-3)
const startsAt = new Date("2026-11-05T12:00:00Z");
const base = { name: "Lucía Fernández", startsAt, location: "Consultorio" };
// Un día antes (4/11 a las 09:00 de Argentina) y el mismo día (5/11 a las 07:00).
const dayBefore = new Date("2026-11-04T12:00:00Z");
const sameDay = new Date("2026-11-05T10:00:00Z");
// Pasada la medianoche del día del turno: un aviso de "24 h" que sale a las 00:30.
const justAfterMidnight = new Date("2026-11-05T03:30:00Z");

describe("mensajes de recordatorio", () => {
  it("usa la hora de Argentina", () => {
    expect(whenLabel(startsAt, dayBefore)).toBe("mañana (jueves, 5 de noviembre) a las 09:00");
    expect(whenLabel(startsAt, sameDay)).toBe("hoy a las 09:00");
  });
  it("dice hoy o mañana según la fecha real, también pasada la medianoche", () => {
    expect(whenLabel(startsAt, justAfterMidnight)).toBe("hoy a las 09:00");
    // Turno a las 22:00 del 5/11: el aviso de 24 h sale entre las 22:00 del 4/11 y la 01:00 del 5/11.
    const at22 = new Date("2026-11-06T01:00:00Z");
    expect(whenLabel(at22, new Date("2026-11-05T01:30:00Z"))).toBe("mañana (jueves, 5 de noviembre) a las 22:00"); // 22:30 del 4/11
    expect(whenLabel(at22, new Date("2026-11-05T03:30:00Z"))).toBe("hoy a las 22:00"); // 00:30 del 5/11
  });
  it("si faltan más de dos días nombra el día", () => {
    expect(whenLabel(startsAt, new Date("2026-11-02T12:00:00Z"))).toBe("el jueves, 5 de noviembre a las 09:00");
  });
  it("el email es neutro y trae el link a la app", () => {
    const m = emailContent({ ...base, now: dayBefore, appUrl: "https://turnos.example.com/" });
    expect(m.subject).toBe("Recordatorio de turno: mañana a las 09:00");
    expect(m.text).toContain("Hola Lucía,");
    expect(m.text).toContain("https://turnos.example.com/paciente");
    expect(`${m.subject}${m.text}${m.html}`).not.toMatch(/psic|terapia|sesi[oó]n|consulta cl/i);
  });
  it("el asunto del email también usa la fecha real", () => {
    expect(emailContent({ ...base, now: justAfterMidnight, appUrl: "http://a" }).subject).toBe("Recordatorio de turno: hoy a las 09:00");
  });
  it("escapa el HTML del lugar y del nombre", () => {
    const m = emailContent({ ...base, name: "<b>X</b>", location: "<script>", now: sameDay, appUrl: "http://a" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<b>X</b>");
  });
  it("la notificación push es corta y neutra", () => {
    expect(pushContent({ ...base, now: sameDay })).toEqual({
      title: "Recordatorio de turno",
      body: "Hoy a las 09:00 · Consultorio",
      url: "/paciente",
    });
  });
  it("el texto de WhatsApp lleva nombre, día y hora", () => {
    const t = whatsappReminderText(base);
    expect(t).toContain("Hola Lucía");
    expect(t).toContain("09:00");
    expect(t).toContain("5 de noviembre");
  });
});
