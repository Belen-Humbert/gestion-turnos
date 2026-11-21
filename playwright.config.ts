import { defineConfig } from "@playwright/test";
import { appEnv, VAPID, BASE, BASE_MAIL, PORT, PORT_MAIL, SMTP_PORT } from "./e2e/env";

// Pruebas de punta a punta. Dos copias de la app: la 3100 sin email ni push (todo se simula) y la 3101
// con un servidor SMTP de prueba y claves push (recuperar contraseña y recordatorios).
// Se corren con `npm run e2e` (prepara la base y compila antes).
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  workers: 1, // comparten una base de datos: van de a una
  fullyParallel: false,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: BASE, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires" },
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `${BASE}/login`,
      env: appEnv(),
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next start -p ${PORT_MAIL}`,
      url: `${BASE_MAIL}/login`,
      env: appEnv({
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(SMTP_PORT),
        MAIL_FROM: "Turnos <no-reply@example.com>",
        APP_URL: BASE_MAIL,
        VAPID_PUBLIC_KEY: VAPID.publicKey,
        VAPID_PRIVATE_KEY: VAPID.privateKey,
        VAPID_SUBJECT: "mailto:prueba@example.com",
      }),
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
