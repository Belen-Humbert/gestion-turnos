import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { users } from "../src/db/schema";
import { createInvitation, invitationUrl } from "../src/lib/invitations";

// Herramienta de desarrollo hasta que exista el alta de pacientes en el panel.
// Uso: npm run invite -- paciente@mail.com "Nombre Apellido"
async function main() {
  const [emailArg, nameArg] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (!email || !nameArg) throw new Error('Uso: npm run invite -- email "Nombre Apellido"');
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({ role: "patient", name: nameArg, email }).returning();
  }
  const token = await createInvitation(user.id);
  console.log(invitationUrl(token));
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
