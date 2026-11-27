// Reglas de la portada de un libro. Sin dependencias de servidor: lo usa también el navegador.
import { classifyFile, displayFileName, formatBytes } from "@/lib/forum/files";

export const COVER_MAX_BYTES = 8 * 1024 * 1024;
const COVER_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export type CoverCheck =
  | { ok: true; ext: string; mime: string; fileName: string }
  | { ok: false; error: string };

export function validateCover(file: { name: string; size: number }): CoverCheck {
  const fileName = displayFileName(file.name);
  const type = classifyFile(fileName);
  if (!type || !COVER_EXTENSIONS.includes(type.ext)) {
    return { ok: false, error: "La portada tiene que ser una foto (JPG, PNG o WEBP)." };
  }
  if (!Number.isInteger(file.size) || file.size <= 0) return { ok: false, error: "La foto está vacía." };
  if (file.size > COVER_MAX_BYTES) {
    return { ok: false, error: `La foto pesa ${formatBytes(file.size)} y el máximo es ${formatBytes(COVER_MAX_BYTES)}.` };
  }
  return { ok: true, ext: type.ext, mime: type.mime, fileName };
}

export const TITLE_MAX = 150;
export const AUTHOR_MAX = 120;
