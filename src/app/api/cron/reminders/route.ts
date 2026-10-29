import { timingSafeEqual } from "node:crypto";
import { runReminders } from "@/lib/reminders";

// Lo llama un programador externo (cron del hosting, GitHub Actions, cron-job.org…) cada ~10 minutos:
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/reminders
// Sin CRON_SECRET configurado queda deshabilitado. No devuelve datos personales.
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 16) {
    return Response.json({ error: "Deshabilitado: falta CRON_SECRET (mínimo 16 caracteres)." }, { status: 503 });
  }
  if (!authorized(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  const summary = await runReminders();
  return Response.json(summary);
}

export const POST = handle;
export const GET = handle;
