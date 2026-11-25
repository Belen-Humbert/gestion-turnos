import "dotenv/config";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";
import { phoneKey } from "../src/lib/phone";

// Los celulares que ya estaban cargados reciben su clave normalizada (para ingresar con el celular).
// Si dos pacientes tienen el mismo celular, solo el primero recibe la clave.
async function backfillPhoneKeys() {
  const rows = await db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(and(isNotNull(users.phone), isNull(users.phoneKey)));
  let done = 0;
  for (const r of rows) {
    const key = phoneKey(r.phone);
    if (!key) continue;
    try {
      await db.update(users).set({ phoneKey: key }).where(eq(users.id, r.id));
      done++;
    } catch {
      console.warn(`Celular repetido, sin clave de ingreso: ${r.phone}`);
    }
  }
  if (done) console.log(`Celulares normalizados: ${done}`);
}

migrate(db, { migrationsFolder: "./drizzle" })
  .then(backfillPhoneKeys)
  .then(() => console.log("Migraciones aplicadas"))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
