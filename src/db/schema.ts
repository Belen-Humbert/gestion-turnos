import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const eventKindEnum = pgEnum("event_kind", ["appointment", "other"]);

export const roleEnum = pgEnum("role", ["admin", "patient"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: roleEnum("role").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  // Null hasta que el paciente acepta la invitación y crea su contraseña.
  passwordHash: text("password_hash"),
  // Un paciente desactivado conserva su historial pero no puede ingresar.
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Se guarda solo el hash del token: el token real viaja únicamente en el link.
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invitations_user_idx").on(t.userId)],
);

// Sesiones en base de datos: se pueden revocar (por ejemplo al desactivar a un paciente).
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type Role = User["role"];

// Agenda de la administradora: citas con pacientes y otros eventos (clases, compromisos).
// Dos eventos activos nunca se superponen: lo garantiza una restricción de exclusión en la
// base (ver la migración events_no_overlap), además del chequeo con mensaje claro en la app.
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: eventKindEnum("kind").notNull(),
    // Solo para citas.
    patientId: uuid("patient_id").references(() => users.id, { onDelete: "restrict" }),
    // Solo para otros eventos.
    title: text("title"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    location: text("location"),
    // Nota privada: solo la ve la administradora.
    privateNote: text("private_note"),
    // Cuando el paciente confirma asistencia (paso 3). Mientras es null, la cita está sin confirmar.
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    // Cancelar libera el horario pero conserva el registro.
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    // Las repeticiones semanales comparten la serie.
    seriesId: uuid("series_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_starts_idx").on(t.startsAt),
    index("events_patient_idx").on(t.patientId),
    index("events_series_idx").on(t.seriesId),
    check("events_range_ok", sql`${t.endsAt} > ${t.startsAt}`),
    check(
      "events_kind_fields",
      sql`(${t.kind} = 'appointment' and ${t.patientId} is not null) or (${t.kind} = 'other' and ${t.title} is not null)`,
    ),
  ],
);

export type CalendarEvent = typeof events.$inferSelect;
