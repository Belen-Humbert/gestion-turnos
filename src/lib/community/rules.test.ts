import { describe, expect, it } from "vitest";
import { addOneMonth, DESCRIPTION_MAX, validatePost } from "./rules";

describe("duración de un mes", () => {
  it("suma un mes calendario", () => {
    expect(addOneMonth(new Date("2026-11-27T15:00:00Z")).toISOString()).toBe("2026-12-27T15:00:00.000Z");
    expect(addOneMonth(new Date("2026-12-15T10:00:00Z")).toISOString()).toBe("2027-01-15T10:00:00.000Z");
  });
  it("no se pasa de mes cuando el día no existe", () => {
    expect(addOneMonth(new Date("2026-01-31T12:00:00Z")).toISOString()).toBe("2026-02-28T12:00:00.000Z");
    expect(addOneMonth(new Date("2028-01-31T12:00:00Z")).toISOString()).toBe("2028-02-29T12:00:00.000Z");
    expect(addOneMonth(new Date("2026-03-31T12:00:00Z")).toISOString()).toBe("2026-04-30T12:00:00.000Z");
  });
});

describe("formulario de publicación", () => {
  const ok = { title: "Feria de emprendedores", description: "Este sábado en la plaza, desde las 10.", link: "https://www.ejemplo.com/feria" };
  it("acepta título, descripción y enlace", () => {
    const r = validatePost(ok);
    expect(r.ok && r.value.link).toBe("https://www.ejemplo.com/feria");
  });
  it("el enlace es opcional y se completa con https", () => {
    const sin = validatePost({ ...ok, link: "" });
    expect(sin.ok && sin.value.link).toBeNull();
    const corto = validatePost({ ...ok, link: "ejemplo.com/feria" });
    expect(corto.ok && corto.value.link).toBe("https://ejemplo.com/feria");
  });
  it("rechaza enlaces peligrosos o inválidos", () => {
    for (const link of ["javascript:alert(1)", "ftp://x.com/a", "no es un enlace", "http://user:pw@x.com"]) {
      expect(validatePost({ ...ok, link }).ok).toBe(false);
    }
  });
  it("exige título y descripción de tamaño razonable", () => {
    expect(validatePost({ ...ok, title: " a " }).ok).toBe(false);
    expect(validatePost({ ...ok, description: "corto" }).ok).toBe(false);
    expect(validatePost({ ...ok, description: "x".repeat(DESCRIPTION_MAX + 1) }).ok).toBe(false);
    expect(validatePost({ title: 5, description: null, link: undefined }).ok).toBe(false);
  });
});
