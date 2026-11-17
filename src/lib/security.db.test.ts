import "dotenv/config";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, like } from "drizzle-orm";
import { db, pool } from "@/db";
import { passwordResets, rateLimits, users } from "@/db/schema";
import { clearAttempts, isLimited, registerFailure } from "./rate-limit";
import { createPasswordReset, findValidReset, passwordResetEmail, resetUrl } from "./password-reset";

// Pruebas de integración (necesitan DATABASE_URL). Usan claves y correos sec-test-* y limpian al terminar.
const K = "sec-test-key";
async function cleanup() {
  await db.delete(users).where(like(users.email, "sec-test-%"));
  await clearAttempts(K);
  await clearAttempts(K + "-b");
}
async function user(over: Partial<typeof users.$inferInsert> = {}) {
  return (await db.insert(users).values({ role: "patient", name: "Lucía Test", email: `sec-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`, passwordHash: "x", ...over }).returning())[0];
}

afterAll(async () => {
  if (!process.env.DATABASE_URL) return;
  await cleanup();
  await pool.end();
});

describe.skipIf(!process.env.DATABASE_URL)("límite de intentos (con base de datos)", () => {
  beforeEach(cleanup);
  it("bloquea al llegar al máximo y se puede limpiar", async () => {
    for (let i = 0; i < 7; i++) await registerFailure(K);
    expect(await isLimited(K)).toBe(false);
    await registerFailure(K);
    expect(await isLimited(K)).toBe(true);
    await clearAttempts(K);
    expect(await isLimited(K)).toBe(false);
  });

  it("cada clave cuenta por separado", async () => {
    for (let i = 0; i < 8; i++) await registerFailure(K);
    expect(await isLimited(K + "-b")).toBe(false);
  });

  it("los intentos simultáneos no se pierden", async () => {
    await Promise.all(Array.from({ length: 8 }, () => registerFailure(K)));
    expect(await isLimited(K)).toBe(true);
  });

  it("la ventana vencida reinicia el contador", async () => {
    for (let i = 0; i < 8; i++) await registerFailure(K);
    await db.update(rateLimits).set({ resetAt: new Date(Date.now() - 1000) });
    expect(await isLimited(K)).toBe(false);
    await registerFailure(K);
    expect(await isLimited(K)).toBe(false);
  });

  it("acepta un máximo propio", async () => {
    for (let i = 0; i < 3; i++) await registerFailure(K);
    expect(await isLimited(K, 3)).toBe(true);
    expect(await isLimited(K, 4)).toBe(false);
  });

  it("no guarda la clave en claro", async () => {
    await registerFailure(K);
    const rows = await db.select().from(rateLimits);
    expect(rows.some((r) => r.key.includes("sec-test"))).toBe(false);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("recuperación de contraseña (con base de datos)", () => {
  beforeEach(cleanup);

  it("el link sirve para el usuario activo y guarda solo el hash", async () => {
    const u = await user();
    const token = await createPasswordReset(u.id);
    expect((await findValidReset(token))?.userId).toBe(u.id);
    const [row] = await db.select().from(passwordResets).where(eq(passwordResets.userId, u.id));
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toHaveLength(64);
  });

  it("un link nuevo anula el anterior", async () => {
    const u = await user();
    const first = await createPasswordReset(u.id);
    const second = await createPasswordReset(u.id);
    expect(await findValidReset(first)).toBeNull();
    expect(await findValidReset(second)).not.toBeNull();
  });

  it("no sirve vencido, usado ni para un usuario desactivado", async () => {
    const u = await user();
    const t1 = await createPasswordReset(u.id);
    await db.update(passwordResets).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(passwordResets.userId, u.id));
    expect(await findValidReset(t1)).toBeNull();
    const t2 = await createPasswordReset(u.id);
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.userId, u.id));
    expect(await findValidReset(t2)).toBeNull();
    const t3 = await createPasswordReset(u.id);
    await db.update(users).set({ active: false }).where(eq(users.id, u.id));
    expect(await findValidReset(t3)).toBeNull();
    expect(await findValidReset("inventado")).toBeNull();
  });

  it("el email es neutro y escapa el nombre", () => {
    const m = passwordResetEmail("<b>Ana</b> Ruiz", "https://turnos.test/recuperar/abc");
    expect(m.text).toContain("https://turnos.test/recuperar/abc");
    expect(m.html).not.toContain("<b>Ana</b>");
    expect(`${m.subject}${m.text}`.toLowerCase()).not.toContain("turno ");
    expect(resetUrl("t", "https://x.test/")).toBe("https://x.test/recuperar/t");
  });
});
