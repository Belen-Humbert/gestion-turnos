// Qué archivos acepta el foro y cómo se validan. Sin dependencias de servidor: lo usa también el navegador.
// Por ahora no se suben videos (pesan mucho): se comparten como enlace. Para habilitarlos, agregar sus
// extensiones acá (mp4, mov, webm) y subir el tope de tamaño.
export type FileCategory = "audio" | "image" | "document";

type FileType = { mime: string; category: FileCategory; inline: boolean };

export const FILE_TYPES: Record<string, FileType> = {
  mp3: { mime: "audio/mpeg", category: "audio", inline: true },
  m4a: { mime: "audio/mp4", category: "audio", inline: true },
  aac: { mime: "audio/aac", category: "audio", inline: true },
  wav: { mime: "audio/wav", category: "audio", inline: true },
  ogg: { mime: "audio/ogg", category: "audio", inline: true },
  opus: { mime: "audio/ogg", category: "audio", inline: true },
  jpg: { mime: "image/jpeg", category: "image", inline: true },
  jpeg: { mime: "image/jpeg", category: "image", inline: true },
  png: { mime: "image/png", category: "image", inline: true },
  webp: { mime: "image/webp", category: "image", inline: true },
  gif: { mime: "image/gif", category: "image", inline: true },
  pdf: { mime: "application/pdf", category: "document", inline: true },
  doc: { mime: "application/msword", category: "document", inline: false },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", category: "document", inline: false },
  xls: { mime: "application/vnd.ms-excel", category: "document", inline: false },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", category: "document", inline: false },
  ppt: { mime: "application/vnd.ms-powerpoint", category: "document", inline: false },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", category: "document", inline: false },
  odt: { mime: "application/vnd.oasis.opendocument.text", category: "document", inline: false },
  epub: { mime: "application/epub+zip", category: "document", inline: false },
  txt: { mime: "text/plain; charset=utf-8", category: "document", inline: false },
};

export const ACCEPT_ATTR = Object.keys(FILE_TYPES).map((e) => `.${e}`).join(",");
export const DEFAULT_MAX_FILE_MB = 100;

export function maxFileBytes(env: string | undefined = process.env.FORUM_MAX_FILE_MB): number {
  const mb = Number(env);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_FILE_MB) * 1024 * 1024;
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function classifyFile(name: string): (FileType & { ext: string }) | null {
  const ext = extensionOf(name);
  const type = Object.hasOwn(FILE_TYPES, ext) ? FILE_TYPES[ext] : undefined;
  return type ? { ...type, ext } : null;
}

// Nombre para mostrar y para el encabezado de descarga: sin carpetas ni caracteres de control.
export function displayFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").replace(/\s+/g, " ").trim();
  return clean.slice(0, 150) || "archivo";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2).replace(".", ",")} GB`;
}

export type UploadCheck =
  | { ok: true; ext: string; mime: string; category: FileCategory; inline: boolean; fileName: string }
  | { ok: false; error: string };

export function validateUpload(file: { name: string; size: number }, maxBytes: number): UploadCheck {
  const fileName = displayFileName(file.name);
  const type = classifyFile(fileName);
  if (!type) {
    return {
      ok: false,
      error: `«${fileName}»: este tipo de archivo no está permitido. Se aceptan audios, imágenes, PDF y documentos. Los videos se comparten como enlace.`,
    };
  }
  if (!Number.isInteger(file.size) || file.size <= 0) return { ok: false, error: `«${fileName}» está vacío.` };
  if (file.size > maxBytes) {
    return { ok: false, error: `«${fileName}» pesa ${formatBytes(file.size)} y el máximo es ${formatBytes(maxBytes)}.` };
  }
  return { ok: true, ext: type.ext, mime: type.mime, category: type.category, inline: type.inline, fileName };
}

// Enlaces externos: solo http/https. Si falta el esquema se asume https.
export function normalizeLink(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > 2000 || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// La clave con la que se guarda el archivo no usa el nombre original: solo un id y la extensión.
const KEY_RE = /^forum\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,5}$/;
export const isValidStorageKey = (key: unknown): key is string => typeof key === "string" && KEY_RE.test(key);
