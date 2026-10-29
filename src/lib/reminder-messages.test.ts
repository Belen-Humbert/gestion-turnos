import { describe, expect, it } from "vitest";
import { emailContent, pushContent, whatsappReminderText, whenLabel } from "./reminder-messages";

// 2026-11-05 09:00 en Argentina (UTC-3)
const startsAt = new Date("2026-11-05T12:00:00Z");
const base = { name: "Lucía Fernández", startsAt, location: "Consultorio" };

describe("mensajes de recordatorio", () => {
  it("usa la hora de Argentina", () => {
    expect(whenLabel(startsAt, "24h")).toBe("mañana (jueves, 5 de noviembre) a las 09:00");
    expect(whenLabel(startsAt, "2h")).toBe("hoy a las 09:00");
  });
  it("el email es neutro y trae el link a la app", () => {
    const m = emailContent({ ...base, kind: "24h", appUrl: "https://turnos.example.com/" });
    expect(m.subject).toBe("Recordatorio de turno: mañana a las 09:00");
    expect(m.text).toContain("Hola Lucía,");
    expect(m.text).toContain("https://turnos.example.com/paciente");
    expect(`${m.subject}${m.text}${m.html}`).not.toMatch(/psic|terapia|sesi[oó]n|consulta cl/i);
  });
  it("escapa el HTML del lugar y del nombre", () => {
    const m = emailContent({ ...base, name: "<b>X</b>", location: "<script>", kind: "2h", appUrl: "http://a" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<b>X</b>");
  });
  it("la notificación push es corta y neutra", () => {
    expect(pushContent({ ...base, kind: "2h" })).toEqual({
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
