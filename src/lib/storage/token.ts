import { createHmac, timingSafeEqual } from "node:crypto";

// URL firmada para el almacenamiento local: lleva adentro qué se puede hacer (subir o bajar),
// sobre qué archivo y hasta cuándo. Es el equivalente local de las URLs prefirmadas de R2 o S3.
export type StorageClaims = {
  op: "put" | "get";
  key: string;
  exp: number; // milisegundos desde 1970
  ct: string;
  size?: number; // solo para subir: tamaño exacto esperado
  name?: string; // solo para bajar: nombre del archivo
  disp?: "inline" | "attachment";
};

const b64 = (buf: Buffer) => buf.toString("base64url");
const mac = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest();

export function signToken(claims: StorageClaims, secret: string): string {
  const payload = b64(Buffer.from(JSON.stringify(claims)));
  return `${payload}.${b64(mac(payload, secret))}`;
}

export function verifyToken(token: string, secret: string, now = Date.now()): StorageClaims | null {
  const [payload, sig, ...rest] = token.split(".");
  if (!payload || !sig || rest.length) return null;
  const expected = mac(payload, secret);
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StorageClaims;
    if ((claims.op !== "put" && claims.op !== "get") || typeof claims.key !== "string" || typeof claims.exp !== "number") return null;
    return claims.exp > now ? claims : null;
  } catch {
    return null;
  }
}
