import { describe, expect, it } from "vitest";
import { COVER_MAX_BYTES, validateCover } from "./covers";

describe("portada del libro", () => {
  it("acepta fotos comunes", () => {
    for (const n of ["tapa.jpg", "tapa.JPEG", "tapa.png", "tapa.webp"]) {
      expect(validateCover({ name: n, size: 1000 }).ok).toBe(true);
    }
  });
  it("rechaza lo que no es una foto", () => {
    for (const n of ["libro.pdf", "audio.mp3", "tapa.gif", "tapa", "tapa.exe"]) {
      expect(validateCover({ name: n, size: 1000 }).ok).toBe(false);
    }
  });
  it("rechaza archivos vacíos o demasiado pesados", () => {
    expect(validateCover({ name: "a.jpg", size: 0 }).ok).toBe(false);
    expect(validateCover({ name: "a.jpg", size: COVER_MAX_BYTES + 1 }).ok).toBe(false);
    expect(validateCover({ name: "a.jpg", size: COVER_MAX_BYTES }).ok).toBe(true);
  });
});
