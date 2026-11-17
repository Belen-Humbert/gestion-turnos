import { createHash } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

// Límite de intentos guardado en la base (vale con varias instancias y sobrevive a reinicios).
// La clave se hashea: no se guardan emails ni direcciones IP en claro.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export async function isLimited(key: string, max = MAX_ATTEMPTS): Promise<boolean> {
  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, hashKey(key))).limit(1);
  if (!row || row.resetAt.getTime() < Date.now()) return false;
  return row.count >= max;
}

// Cuenta un intento. La suma es atómica: dos pedidos simultáneos no pisan el contador.
export async function registerFailure(key: string, windowMs = WINDOW_MS): Promise<void> {
  const h = hashKey(key);
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  await db
    .insert(rateLimits)
    .values({ key: h, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} < ${now} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < ${now} then ${resetAt} else ${rateLimits.resetAt} end`,
      },
    });
  // Limpieza ocasional de contadores vencidos.
  if (Math.random() < 0.02) await db.delete(rateLimits).where(lt(rateLimits.resetAt, now));
}

export async function clearAttempts(key: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, hashKey(key)));
}
