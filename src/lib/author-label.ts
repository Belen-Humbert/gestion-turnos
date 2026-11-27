import { NO_ALIAS_LABEL } from "./alias";

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

// Cómo se muestra quien escribió algo. El recorte se hace en el servidor para que el nombre real
// de un paciente nunca llegue al navegador de otro paciente: los demás ven solo su nombre de usuario.
export function authorLabel(
  viewerRole: "admin" | "patient",
  author: { role: "admin" | "patient"; name: string; alias: string | null },
): string {
  if (author.role === "admin") return viewerRole === "admin" ? author.name : firstName(author.name);
  if (viewerRole === "admin") return author.alias ? `${author.name} · ${author.alias}` : author.name;
  return author.alias ?? NO_ALIAS_LABEL;
}
