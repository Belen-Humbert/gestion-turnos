import bcrypt from "bcryptjs";

const ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Se compara contra un hash de relleno cuando el email no existe, para que el tiempo de
// respuesta no revele qué emails están registrados.
let dummyHash: Promise<string> | undefined;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("relleno-no-es-una-contrasena");
  return dummyHash;
}
