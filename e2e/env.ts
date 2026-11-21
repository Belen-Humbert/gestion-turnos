// Configuración común de las pruebas e2e. Usan SU PROPIA base de datos (la de desarrollo + "_e2e")
// para no tocar nunca tus datos reales.
import "dotenv/config";

export const PORT = 3100; // app sin email configurado (recordatorios y avisos simulados)
export const PORT_MAIL = 3101; // app con email apuntando al servidor SMTP de prueba
export const SMTP_PORT = 2525;
export const BASE = `http://localhost:${PORT}`;
export const BASE_MAIL = `http://localhost:${PORT_MAIL}`;

export const ADMIN = {
  email: "ana@example.com",
  password: "clave-de-prueba-123",
  name: "Ana Pérez",
};
export const DEMO_PASSWORD = "demo-paciente-123";
export const CRON_SECRET = "secreto-de-prueba-123456";
export const STORAGE_SECRET = "test-secret-test-secret-test-secret-12345";
export const MAX_FILE_MB = 5;
// Claves VAPID de prueba (sirven solo para estas pruebas, no son secretas).
export const VAPID = {
  publicKey:
    "BOZXS8-997hALVWZUXrq4eee6Kt3aJEum02t6x3j7NZ2UUwVRvs8Tcl7XIaC4hmaxdZ1Qu2ghKDaFUXsteqSfLY",
  privateKey: "Ese8xN-uSqAoIc-LoVSwG9ZgfQ20bhyxswVICSPXmfw",
};

export function e2eDatabaseUrl(): string {
  const explicit = process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  let url = explicit;
  if (!url) {
    if (!base)
      throw new Error(
        "Falta DATABASE_URL en el .env (o definí E2E_DATABASE_URL).",
      );
    const u = new URL(base);
    u.pathname = `/${u.pathname.replace(/^\//, "")}_e2e`;
    url = u.toString();
  }
  const name = new URL(url).pathname.replace(/^\//, "");
  // Freno de seguridad: estas pruebas borran datos. Solo corren contra una base de pruebas.
  if (!/e2e|test/i.test(name))
    throw new Error(
      `La base «${name}» no parece de pruebas (debe incluir "e2e" o "test").`,
    );
  if (
    base &&
    new URL(base).pathname === new URL(url).pathname &&
    new URL(base).host === new URL(url).host
  ) {
    throw new Error("La base e2e no puede ser la misma que DATABASE_URL.");
  }
  return url;
}

// Variables que reciben los procesos hijos (app, migraciones, seeds).
export function appEnv(
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    ...(process.env as Record<string, string>),
    DATABASE_URL: e2eDatabaseUrl(),
    NEXT_DIST_DIR: ".next-e2e",
    STORAGE_DRIVER: "local",
    STORAGE_LOCAL_DIR: ".storage-e2e",
    STORAGE_SECRET,
    FORUM_MAX_FILE_MB: String(MAX_FILE_MB),
    CRON_SECRET,
    SMTP_HOST: "",
    VAPID_PUBLIC_KEY: "",
    VAPID_PRIVATE_KEY: "",
    ADMIN_EMAIL: ADMIN.email,
    ADMIN_NAME: ADMIN.name,
    ADMIN_PASSWORD: ADMIN.password,
    ...extra,
  };
}
