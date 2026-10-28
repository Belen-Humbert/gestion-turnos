import "dotenv/config";
import { inArray, like } from "drizzle-orm";
import { db, pool } from "../src/db";
import { changeRequests, events, invitations, patientNotes, sessions, users } from "../src/db/schema";
import { addDays, localToDate, snapToWeekday, todayYmd } from "../src/lib/dates";
import { hashPassword } from "../src/lib/password";

// Pacientes y citas de PRUEBA para desarrollo. Nunca usar en producción.
//   npm run seed:demo           crea (o completa) los datos de prueba
//   npm run seed:demo -- --reset  borra los datos de prueba
// Todos entran con la contraseña DEMO_PASSWORD y el correo demo1@example.com, demo2@example.com…
const DEMO_PASSWORD = "demo-paciente-123";
const PEOPLE = [
  { name: "Lucía Fernández", phone: "261 555 0101" },
  { name: "Martín Giménez", phone: "261 555 0102" },
  { name: "Sofía Rodríguez", phone: "261 555 0103" },
  { name: "Tomás Herrera", phone: "261 555 0104" },
  { name: "Valentina Ortiz", phone: "261 555 0105" },
  { name: "Joaquín Molina", phone: "261 555 0106" },
];

async function reset() {
  const demo = await db.select({ id: users.id }).from(users).where(like(users.email, "demo%@example.com"));
  const ids = demo.map((d) => d.id);
  if (ids.length === 0) return console.log("No hay datos de prueba.");
  await db.delete(changeRequests).where(inArray(changeRequests.patientId, ids));
  await db.delete(patientNotes).where(inArray(patientNotes.patientId, ids));
  await db.delete(events).where(inArray(events.patientId, ids));
  await db.delete(sessions).where(inArray(sessions.userId, ids));
  await db.delete(invitations).where(inArray(invitations.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
  console.log(`Se borraron ${ids.length} pacientes de prueba y sus datos.`);
}

async function main() {
  if (process.argv.includes("--reset")) return reset();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const start = snapToWeekday(addDays(todayYmd(), 1));
  let created = 0;
  for (const [i, p] of PEOPLE.entries()) {
    const email = `demo${i + 1}@example.com`;
    const [user] = await db
      .insert(users)
      .values({ role: "patient", name: p.name, email, phone: p.phone, passwordHash, active: i !== 5 })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!user) continue; // ya existía
    created++;
    if (i === 5) continue; // el inactivo no tiene cita
    // Una cita por paciente: se busca el primer horario libre a partir de un día distinto para cada uno.
    let placed = false;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      let day = start;
      for (let k = 0; k < i + Math.floor(attempt / 8); k++) day = snapToWeekday(addDays(day, 1));
      const startsAt = localToDate(day, `${String(9 + (attempt % 8)).padStart(2, "0")}:00`);
      const endsAt = new Date(startsAt.getTime() + 45 * 60000);
      try {
        const [ev] = await db
          .insert(events)
          .values({
            kind: "appointment",
            patientId: user.id,
            startsAt,
            endsAt,
            location: "Consultorio",
            privateNote: i === 1 ? "Nota de prueba: cita con nota privada." : null,
            confirmedAt: i % 2 === 0 ? new Date() : null,
          })
          .returning({ id: events.id });
        if (i === 2) {
          await db.insert(changeRequests).values({
            eventId: ev.id,
            patientId: user.id,
            message: "No voy a poder asistir ese día. ¿Podemos coordinar otro horario?",
          });
        }
        placed = true;
      } catch {
        // Horario ocupado: se prueba el siguiente.
      }
    }
    if (!placed) console.log(`  (no se encontró horario libre para ${p.name})`);
  }
  console.log(`Pacientes de prueba creados: ${created}. Contraseña de todos: ${DEMO_PASSWORD}`);
  console.log("Correos: demo1@example.com … demo5@example.com (demo6 está inactivo).");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
