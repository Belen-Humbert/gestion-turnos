import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/password";

// Uso: ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... npm run seed:admin
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim() || "Ana";
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Definí ADMIN_EMAIL y ADMIN_PASSWORD");
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db.update(users).set({ passwordHash, name, role: "admin", active: true }).where(eq(users.id, existing.id));
    console.log(`Administrador actualizado: ${email}`);
  } else {
    await db.insert(users).values({ role: "admin", name, email, passwordHash });
    console.log(`Administrador creado: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
