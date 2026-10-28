import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
  // Preferencias de recordatorio del paciente (el paso 4 las usa para decidir qué enviar).
  remindEmail: boolean("remind_email").notNull().default(true),
  remindPush: boolean("remind_push").notNull().default(true),
  remind24h: boolean("remind_24h").notNull().default(true),
  remind2h: boolean("remind_2h").notNull().default(true),
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

// Notas privadas sobre un paciente. Solo las ve la administradora: ninguna pantalla ni
// notificación del paciente debe leer esta tabla.
export const patientNotes = pgTable(
  "patient_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("patient_notes_patient_idx").on(t.patientId, t.createdAt)],
);

// Pedidos de cambio de turno: el paciente no reprograma, solo avisa con un mensaje y la
// administradora decide. Como máximo un pedido abierto por cita.
export const changeRequests = pgTable(
  "change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("change_requests_patient_idx").on(t.patientId),
    uniqueIndex("change_requests_one_open_idx").on(t.eventId).where(sql`${t.resolvedAt} is null`),
  ],
);
