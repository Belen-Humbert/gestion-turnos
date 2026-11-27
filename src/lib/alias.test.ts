import { describe, expect, it } from "vitest";
import { aliasKey, validateAlias } from "./alias";

describe("nombre de usuario ficticio", () => {
  it("acepta nombres razonables", () => {
    for (const a of ["Luna", "Cedro_82", "Mar y Sol", "búho.nocturno", "Ñandú-7"]) {
      expect(validateAlias(a, "Lucía Fernández").ok).toBe(true);
    }
  });
  it("normaliza para no repetir", () => {
    expect(aliasKey("  LUNA  ")).toBe("luna");
    expect(aliasKey("Búho  Nocturno")).toBe("buho nocturno");
    const a = validateAlias("Búho", "x y");
    expect(a.ok && a.key).toBe("buho");
  });
  it("rechaza largos, símbolos y vacíos", () => {
    expect(validateAlias("ab").ok).toBe(false);
    expect(validateAlias("a".repeat(25)).ok).toBe(false);
    expect(validateAlias("hola@mail.com").ok).toBe(false);
    expect(validateAlias("<b>hola</b>").ok).toBe(false);
    expect(validateAlias("   ").ok).toBe(false);
    expect(validateAlias("-guion").ok).toBe(false);
  });
  it("rechaza nombres reservados y el nombre real", () => {
    expect(validateAlias("Administradora").ok).toBe(false);
    expect(validateAlias("ANA").ok).toBe(false);
    expect(validateAlias("Lucía", "Lucía Fernández").ok).toBe(false);
    expect(validateAlias("lucia fernandez", "Lucía Fernández").ok).toBe(false);
    expect(validateAlias("Fernández", "Lucía Fernández").ok).toBe(false);
  });
});
