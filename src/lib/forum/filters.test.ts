import { describe, expect, it } from "vitest";
import { attachmentGroup, parseFilter, parseFilters } from "./filters";

describe("filtros del foro", () => {
  it("agrupa los adjuntos por tipo", () => {
    expect(attachmentGroup("file", "audio/mpeg")).toBe("audio");
    expect(attachmentGroup("file", "image/png")).toBe("imagen");
    expect(attachmentGroup("file", "application/pdf")).toBe("documento");
    expect(attachmentGroup("file", null)).toBe("documento");
    expect(attachmentGroup("link", null)).toBe("enlace");
    expect(attachmentGroup("link", null, "https://example.com/nota")).toBe(
      "enlace",
    );
    expect(
      attachmentGroup("link", null, "https://www.youtube.com/watch?v=abc"),
    ).toBe("video");
    expect(attachmentGroup("link", null, "https://youtu.be/abc")).toBe("video");
    expect(attachmentGroup("link", null, "https://vimeo.com/123")).toBe(
      "video",
    );
    expect(attachmentGroup("link", null, "https://notyoutube.com/x")).toBe(
      "enlace",
    );
  });
  it("acepta varios filtros a la vez", () => {
    expect(parseFilters("audio,imagen")).toEqual(["audio", "imagen"]);
    expect(parseFilters("imagen,audio,imagen,xx")).toEqual(["audio", "imagen"]);
    expect(parseFilters(undefined)).toEqual([]);
    expect(parseFilters("'; drop")).toEqual([]);
  });
  it("solo acepta filtros conocidos", () => {
    expect(parseFilter("audio")).toBe("audio");
    expect(parseFilter(["enlace", "audio"])).toBe("enlace");
    expect(parseFilter("todo")).toBeNull();
    expect(parseFilter("'; drop table")).toBeNull();
    expect(parseFilter(undefined)).toBeNull();
  });
});
