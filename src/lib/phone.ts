import { whatsappNumber } from "./whatsapp";

// Clave única de un celular argentino (formato de WhatsApp: 549 + código de área + número).
// Dos formas de escribir el mismo celular (con 0, con 15, con +54) dan la misma clave.
export function phoneKey(raw: string | null | undefined): string | null {
  return whatsappNumber(raw);
}

export type LoginId = { kind: "email"; value: string } | { kind: "phone"; value: string } | null;

// Lo que escribe quien ingresa: un email (tiene @) o un celular.
export function parseLoginId(raw: string): LoginId {
  const v = raw.trim();
  if (!v) return null;
  if (v.includes("@")) return { kind: "email", value: v.toLowerCase() };
  const key = phoneKey(v);
  return key ? { kind: "phone", value: key } : null;
}
