import { describe, expect, it } from "vitest";
import { invitationMessage, whatsappLink, whatsappNumber } from "./whatsapp";

describe("whatsappNumber", () => {
  it("acepta formatos comunes de Mendoza", () => {
    expect(whatsappNumber("261 555 0123")).toBe("5492615550123");
    expect(whatsappNumber("0261 555-0123")).toBe("5492615550123");
    expect(whatsappNumber("+54 9 261 555 0123")).toBe("5492615550123");
    expect(whatsappNumber("54 261 5550123")).toBe("5492615550123");
  });
  it("quita el 15", () => {
    expect(whatsappNumber("261 15 555 0123")).toBe("5492615550123");
    expect(whatsappNumber("0261 15-5550123")).toBe("5492615550123");
  });
  it("rechaza lo que no parece un celular", () => {
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber("123")).toBeNull();
    expect(whatsappNumber("abc")).toBeNull();
  });
});

describe("whatsappLink", () => {
  it("codifica el mensaje", () => {
    const url = whatsappLink("2615550123", "Hola, ¿cómo estás?");
    expect(url).toBe("https://wa.me/5492615550123?text=Hola%2C%20%C2%BFc%C3%B3mo%20est%C3%A1s%3F");
  });
  it("devuelve null sin teléfono válido", () => {
    expect(whatsappLink("xx", "hola")).toBeNull();
  });
});

describe("invitationMessage", () => {
  it("usa el primer nombre y el link", () => {
    expect(invitationMessage("Lucía Martínez", "https://x.test/i/abc")).toContain("Hola Lucía,");
    expect(invitationMessage("Lucía Martínez", "https://x.test/i/abc")).toContain("https://x.test/i/abc");
  });
});
