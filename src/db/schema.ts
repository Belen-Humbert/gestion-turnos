import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
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

// Dispositivos del paciente que activaron las notificaciones (Web Push).
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

// Un recordatorio por cita, momento y canal: la restricción única evita enviarlo dos veces
// aunque el proceso corra varias veces o en paralelo.
export const reminderLog = pgTable(
  "reminder_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    channel: text("channel").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reminder_log_unique_idx").on(t.eventId, t.kind, t.channel),
    check("reminder_log_kind_ok", sql`${t.kind} in ('24h', '2h')`),
    check("reminder_log_channel_ok", sql`${t.channel} in ('email', 'push')`),
  ],
);

// --- Foro -------------------------------------------------------------------------------------
// Solo la administradora publica. Los pacientes leen y comentan.
export const forumPosts = pgTable(
  "forum_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    // Si es false, los pacientes no pueden agregar comentarios nuevos.
    commentsOpen: boolean("comments_open").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("forum_posts_created_idx").on(t.createdAt)],
);

// Un adjunto es un archivo subido al almacenamiento (audio, documento, imagen) o un enlace externo.
export const forumAttachments = pgTable(
  "forum_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => forumPosts.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    // Texto que ve el paciente: el nombre del archivo o el título del enlace.
    label: text("label").notNull(),
    url: text("url"),
    storageKey: text("storage_key").unique(),
    fileName: text("file_name"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("forum_attachments_post_idx").on(t.postId, t.position),
    check("forum_attachments_kind_ok", sql`${t.kind} in ('file', 'link')`),
    check(
      "forum_attachments_shape",
      sql`(${t.kind} = 'file' and ${t.storageKey} is not null and ${t.contentType} is not null) or (${t.kind} = 'link' and ${t.url} is not null)`,
    ),
  ],
);

// Comentarios de pacientes (y respuestas de la administradora). Ocultar es la moderación: el
// comentario deja de verse para los pacientes pero la administradora lo conserva y lo puede restaurar.
export const forumComments = pgTable(
  "forum_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => forumPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    // Cuando la administradora lo vio; sirve para el aviso de comentarios nuevos.
    adminSeenAt: timestamp("admin_seen_at", { withTimezone: true }),
  },
  (t) => [
    index("forum_comments_post_idx").on(t.postId, t.createdAt),
    index("forum_comments_user_idx").on(t.userId, t.createdAt),
  ],
);
