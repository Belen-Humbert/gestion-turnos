import "dotenv/config";
import { pool } from "../src/db";
import { mailConfigured } from "../src/lib/mailer";
import { pushConfigured } from "../src/lib/push";
import { runReminders } from "../src/lib/reminders";

// Corre una pasada de recordatorios. En producción lo ejecuta un programador cada 10 minutos
// (ver README): este script o el endpoint /api/cron/reminders.
runReminders()
  .then((s) => {
    console.log(`Citas a avisar: ${s.candidates} · emails: ${s.email} · push: ${s.push} · errores: ${s.errors}`);
    if (!mailConfigured()) console.log("(SMTP no configurado: los emails se simularon y no se marcan como enviados)");
    if (!pushConfigured()) console.log("(VAPID no configurado: las notificaciones push se simularon)");
  })
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
