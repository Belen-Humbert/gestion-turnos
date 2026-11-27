import { describe, expect, it } from "vitest";
import { authorLabel } from "./author-label";

const patient = { role: "patient" as const, name: "Lucía Fernández", alias: "Luna" };
describe("nombre que se muestra", () => {
  it("los pacientes ven solo el nombre de usuario de otro paciente", () => {
    expect(authorLabel("patient", patient)).toBe("Luna");
    expect(authorLabel("patient", { ...patient, alias: null })).toBe("Anónimo/a");
    expect(authorLabel("patient", patient)).not.toContain("Lucía");
  });
  it("Ana ve el nombre real y el nombre de usuario", () => {
    expect(authorLabel("admin", patient)).toBe("Lucía Fernández · Luna");
    expect(authorLabel("admin", { ...patient, alias: null })).toBe("Lucía Fernández");
  });
  it("de Ana, los pacientes ven el nombre de pila", () => {
    const ana = { role: "admin" as const, name: "Ana Pérez", alias: null };
    expect(authorLabel("patient", ana)).toBe("Ana");
    expect(authorLabel("admin", ana)).toBe("Ana Pérez");
  });
});
