import { describe, expect, it } from "vitest";
import { classifyFile, displayFileName, formatBytes, isValidStorageKey, linkHost, maxFileBytes, normalizeLink, validateUpload } from "./files";

const MB = 1024 * 1024;

describe("validateUpload", () => {
  it("acepta audios, documentos e imágenes", () => {
    for (const name of ["meditacion.mp3", "Guía.PDF", "lectura.docx", "foto.JPG", "nota.m4a"]) {
      expect(validateUpload({ name, size: 1000 }, 100 * MB).ok, name).toBe(true);
    }
  });
  it("rechaza tipos peligrosos o no permitidos", () => {
    for (const name of ["a.html", "a.svg", "a.js", "a.exe", "a.php", "a.mp4", "sin-extension", "doble.pdf.exe", "a.htm", ".pdf.html"]) {
      expect(validateUpload({ name, size: 1000 }, 100 * MB).ok, name).toBe(false);
    }
  });
  it("explica que el video va como enlace", () => {
    const r = validateUpload({ name: "clase.mp4", size: 1000 }, 100 * MB);
    expect(r.ok ? "" : r.error).toMatch(/enlace/);
  });
  it("rechaza vacíos y los que pasan el máximo", () => {
    expect(validateUpload({ name: "a.mp3", size: 0 }, 100 * MB).ok).toBe(false);
    expect(validateUpload({ name: "a.mp3", size: 100 * MB + 1 }, 100 * MB).ok).toBe(false);
    expect(validateUpload({ name: "a.mp3", size: 100 * MB }, 100 * MB).ok).toBe(true);
    expect(validateUpload({ name: "a.mp3", size: 1.5 }, 100 * MB).ok).toBe(false);
  });
  it("no se confunde con propiedades heredadas", () => {
    expect(classifyFile("a.constructor")).toBeNull();
    expect(classifyFile("a.__proto__")).toBeNull();
  });
});

describe("displayFileName", () => {
  it("saca carpetas y caracteres de control", () => {
    expect(displayFileName("C:\\Users\\ana\\Guía de respiración.pdf")).toBe("Guía de respiración.pdf");
    expect(displayFileName("../../etc/passwd")).toBe("passwd");
    expect(displayFileName('a"b\r\nc.mp3')).toBe("abc.mp3");
    expect(displayFileName("")).toBe("archivo");
  });
});

describe("normalizeLink", () => {
  it("acepta http y https y completa el esquema", () => {
    expect(normalizeLink("https://www.youtube.com/watch?v=abc")).toBe("https://www.youtube.com/watch?v=abc");
    expect(normalizeLink("drive.google.com/file/d/1")).toBe("https://drive.google.com/file/d/1");
    expect(normalizeLink("  http://ejemplo.com  ")).toBe("http://ejemplo.com/");
  });
  it("rechaza esquemas peligrosos y basura", () => {
    for (const u of ["javascript:alert(1)", "data:text/html,<b>x</b>", "file:///etc/passwd", "ftp://a.com", "vbscript:x", "", "a b.com", "https://user:pass@a.com", "https://localhostx", "mailto:a@b.com"]) {
      expect(normalizeLink(u), u).toBeNull();
    }
    expect(normalizeLink("https://a.com/" + "x".repeat(2000))).toBeNull();
  });
  it("muestra solo el dominio", () => {
    expect(linkHost("https://www.youtube.com/watch?v=abc")).toBe("youtube.com");
  });
});

describe("otros", () => {
  it("formatea tamaños", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5.5 * MB)).toBe("5,5 MB");
  });
  it("el máximo sale de la configuración o es 100 MB", () => {
    expect(maxFileBytes("")).toBe(100 * MB); // sin configurar
    expect(maxFileBytes("25")).toBe(25 * MB);
    expect(maxFileBytes("abc")).toBe(100 * MB);
    expect(maxFileBytes("-5")).toBe(100 * MB);
  });
  it("valida la clave de almacenamiento (sin recorridos de carpeta)", () => {
    expect(isValidStorageKey("forum/3f2a8c1e-1b2c-4d5e-8f90-1234567890ab.mp3")).toBe(true);
    for (const k of ["../etc/passwd", "forum/../x.mp3", "forum/abc.mp3", "/forum/3f2a8c1e-1b2c-4d5e-8f90-1234567890ab.mp3", "forum/3f2a8c1e-1b2c-4d5e-8f90-1234567890ab.mp3/../x", 5, null]) {
      expect(isValidStorageKey(k), String(k)).toBe(false);
    }
  });
});
