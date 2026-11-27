// Reglas de la Comunidad. Sin dependencias de servidor: también las usa el navegador.
import { normalizeLink } from "@/lib/forum/files";

export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 1000;
export const NOTE_MAX = 500;
// Cuántas publicaciones puede tener un paciente esperando revisión o con cambios pedidos a la vez.
export const MAX_OPEN_PER_PATIENT = 3;

// Texto de las normas que ven los pacientes al proponer algo. Ana puede ajustarlo.
export const COMMUNITY_RULES = [
  "Respeto ante todo: nada que ofenda, discrimine o juzgue a otras personas.",
  "No publiques datos personales (tuyos ni de otras personas): teléfonos, direcciones, nombres reales.",
  "Compartí cosas útiles o lindas: emprendimientos, eventos, películas, libros, recomendaciones.",
  "Nada engañoso ni peligroso. Ana revisa cada propuesta antes de publicarla.",
  "Lo publicado se muestra durante un mes.",
];

// Una publicación aprobada dura un mes calendario (el 31 de enero vence el 28 de febrero, no el 3 de marzo).
export function addOneMonth(from: Date): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = new Date(from);
  d.setUTCDate(1);
  d.setUTCMonth(m);
  d.setUTCDate(Math.min(from.getUTCDate(), lastDay));
  return d;
}

export type PostInput = { title: string; description: string; link: string | null };
export type PostCheck = { ok: true; value: PostInput } | { ok: false; error: string };

export function validatePost(raw: { title: unknown; description: unknown; link: unknown }): PostCheck {
  const title = typeof raw.title === "string" ? raw.title.replace(/\s+/g, " ").trim() : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const linkText = typeof raw.link === "string" ? raw.link.trim() : "";
  if (title.length < 3) return { ok: false, error: "Escribí un título (al menos 3 caracteres)." };
  if (title.length > TITLE_MAX) return { ok: false, error: `El título es demasiado largo (máximo ${TITLE_MAX} caracteres).` };
  if (description.length < 10) return { ok: false, error: "Contá de qué se trata (al menos 10 caracteres)." };
  if (description.length > DESCRIPTION_MAX) return { ok: false, error: `La descripción es demasiado larga (máximo ${DESCRIPTION_MAX} caracteres).` };
  let link: string | null = null;
  if (linkText) {
    link = normalizeLink(linkText);
    if (!link) return { ok: false, error: "El enlace no es válido. Tiene que empezar con http:// o https:// (por ejemplo, https://www.ejemplo.com)." };
  }
  return { ok: true, value: { title, description, link } };
}
