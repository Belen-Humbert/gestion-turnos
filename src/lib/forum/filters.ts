// Filtros por tipo de material del foro. Sin dependencias de servidor: lo usan la consulta y la pantalla.
export const FORUM_FILTERS = [
  { key: "audio", label: "Audios" },
  { key: "imagen", label: "Imágenes" },
  { key: "documento", label: "Documentos" },
  { key: "enlace", label: "Enlaces" },
] as const;

export type ForumFilter = (typeof FORUM_FILTERS)[number]["key"];

export function parseFilter(value: unknown): ForumFilter | null {
  const v = Array.isArray(value) ? value[0] : value;
  return FORUM_FILTERS.find((f) => f.key === v)?.key ?? null;
}

// Grupo de un adjunto: los enlaces van aparte; los archivos según su tipo (audio, imagen u otro documento).
export function attachmentGroup(kind: string, contentType: string | null): ForumFilter {
  if (kind === "link") return "enlace";
  if (contentType?.startsWith("audio/")) return "audio";
  if (contentType?.startsWith("image/")) return "imagen";
  return "documento";
}
