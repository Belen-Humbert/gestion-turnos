// Nombre de usuario ficticio. Sin dependencias de servidor: también lo usa el navegador.
export const ALIAS_MIN = 3;
export const ALIAS_MAX = 24;

// Nombres que podrían confundirse con Ana o con el sistema.
const RESERVED = ["ana", "admin", "administrador", "administradora", "consultorio", "psicologa", "moderador", "moderadora", "sistema", "soporte"];

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Clave para comparar: sin tildes, mayúsculas ni espacios de más.
export function aliasKey(raw: string): string {
  return strip(raw);
}

export type AliasCheck = { ok: true; alias: string; key: string } | { ok: false; error: string };

export function validateAlias(raw: string, realName = ""): AliasCheck {
  const alias = raw.replace(/\s+/g, " ").trim();
  if (alias.length < ALIAS_MIN) return { ok: false, error: `El nombre de usuario tiene que tener al menos ${ALIAS_MIN} caracteres.` };
  if (alias.length > ALIAS_MAX) return { ok: false, error: `El nombre de usuario es demasiado largo (máximo ${ALIAS_MAX} caracteres).` };
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(alias)) {
    return { ok: false, error: "Usá solo letras, números, espacios, punto, guion o guion bajo." };
  }
  const key = aliasKey(alias);
  if (RESERVED.includes(key)) return { ok: false, error: "Ese nombre está reservado. Elegí otro." };
  // Que no sea el nombre real (ni solo el nombre de pila): la idea es proteger la identidad.
  const real = strip(realName);
  const parts = real ? [real, ...real.split(" ")] : [];
  if (parts.includes(key)) return { ok: false, error: "Elegí un nombre distinto al tuyo real, para proteger tu identidad." };
  return { ok: true, alias, key };
}

export const NO_ALIAS_LABEL = "Anónimo/a";
