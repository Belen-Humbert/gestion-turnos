import { describe, expect, it } from "vitest";
import { attachmentGroup, parseFilter } from "./filters";

describe("filtros del foro", () => {
  it("agrupa los adjuntos por tipo", () => {
    expect(attachmentGroup("file", "audio/mpeg")).toBe("audio");
    expect(attachmentGroup("file", "image/png")).toBe("imagen");
    expect(attachmentGroup("file", "application/pdf")).toBe("documento");
    expect(attachmentGroup("file", null)).toBe("documento");
    expect(attachmentGroup("link", null)).toBe("enlace");
  });
  it("solo acepta filtros conocidos", () => {
    expect(parseFilter("audio")).toBe("audio");
    expect(parseFilter(["enlace", "audio"])).toBe("enlace");
    expect(parseFilter("todo")).toBeNull();
    expect(parseFilter("'; drop table")).toBeNull();
    expect(parseFilter(undefined)).toBeNull();
  });
});
