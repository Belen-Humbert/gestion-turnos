import { describe, expect, it } from "vitest";
import { parseLoginId, phoneKey } from "./phone";

describe("celular como identificador", () => {
  it("normaliza las distintas formas de escribir el mismo número", () => {
    const k = "5492615550123";
    expect(phoneKey("261 555 0123")).toBe(k);
    expect(phoneKey("0261 15 555 0123")).toBe(k);
    expect(phoneKey("+54 9 261 555-0123")).toBe(k);
    expect(phoneKey("(261) 5550123")).toBe(k);
  });
  it("rechaza lo que no es un celular", () => {
    expect(phoneKey("abc")).toBeNull();
    expect(phoneKey("12345")).toBeNull();
    expect(phoneKey("")).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
  it("distingue email de celular al ingresar", () => {
    expect(parseLoginId(" Ana@Example.com ")).toEqual({ kind: "email", value: "ana@example.com" });
    expect(parseLoginId("261 555 0123")).toEqual({ kind: "phone", value: "5492615550123" });
    expect(parseLoginId("hola")).toBeNull();
    expect(parseLoginId("   ")).toBeNull();
  });
});
