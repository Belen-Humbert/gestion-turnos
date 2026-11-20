// Filtros por tipo de material del foro. Sin dependencias de servidor: lo usan la consulta y la pantalla.
export const FORUM_FILTERS = [
  { key: "audio", label: "Audios" },
  { key: "imagen", label: "Imágenes" },
  { key: "documento", label: "Documentos" },
  { key: "video", label: "Videos" },
  { key: "enlace", label: "Enlaces" },
] as const;

export type ForumFilter = (typeof FORUM_FILTERS)[number]["key"];

export function parseFilter(value: unknown): ForumFilter | null {
  const v = Array.isArray(value) ? value[0] : value;
  return FORUM_FILTERS.find((f) => f.key === v)?.key ?? null;
}

// Varios filtros a la vez (?tipo=audio,imagen): se ignora lo desconocido y lo repetido.
export function parseFilters(value: unknown): ForumFilter[] {
  const raw = Array.isArray(value)
    ? value.join(",")
    : typeof value === "string"
      ? value
      : "";
  const keys = raw.split(",").map((v) => v.trim());
  return FORUM_FILTERS.map((f) => f.key).filter((k) => keys.includes(k));
}

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com"];

function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return VIDEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

// Grupo de un adjunto: los enlaces a YouTube o Vimeo cuentan como video y el resto de los enlaces va aparte; los archivos según su tipo (audio, imagen u otro documento).
export function attachmentGroup(
  kind: string,
  contentType: string | null,
  url?: string | null,
): ForumFilter {
  if (kind === "link") return isVideoUrl(url) ? "video" : "enlace";
  if (contentType?.startsWith("audio/")) return "audio";
  if (contentType?.startsWith("image/")) return "imagen";
  return "documento";
}
