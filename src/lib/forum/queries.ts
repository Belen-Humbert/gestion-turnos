import "server-only";
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { forumAttachments, forumComments, forumPosts, users } from "@/db/schema";

export type PostSummary = {
  id: string;
  title: string;
  body: string;
  commentsOpen: boolean;
  createdAt: Date;
  attachmentCount: number;
  commentCount: number;
  newComments: number; // solo tiene sentido para la administradora
};

export async function listPosts(): Promise<PostSummary[]> {
  return db
    .select({
      id: forumPosts.id,
      title: forumPosts.title,
      body: forumPosts.body,
      commentsOpen: forumPosts.commentsOpen,
      createdAt: forumPosts.createdAt,
      // Las subconsultas usan el nombre completo de la tabla: con una sola tabla en el FROM, Drizzle
      // omite el calificador y "id" quedaría ambiguo.
      attachmentCount: sql<number>`(select count(*)::int from forum_attachments a where a.post_id = forum_posts.id)`,
      commentCount: sql<number>`(select count(*)::int from forum_comments c where c.post_id = forum_posts.id and c.hidden_at is null)`,
      newComments: sql<number>`(select count(*)::int from forum_comments c join users u on u.id = c.user_id where c.post_id = forum_posts.id and c.hidden_at is null and c.admin_seen_at is null and u.role = 'patient')`,
    })
    .from(forumPosts)
    .orderBy(desc(forumPosts.createdAt));
}

export async function getPost(id: string) {
  const [row] = await db.select().from(forumPosts).where(eq(forumPosts.id, id)).limit(1);
  return row ?? null;
}

export type AttachmentView = {
  id: string;
  kind: "file" | "link";
  label: string;
  url: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
};

export async function listAttachments(postId: string): Promise<AttachmentView[]> {
  const rows = await db
    .select({
      id: forumAttachments.id,
      kind: forumAttachments.kind,
      label: forumAttachments.label,
      url: forumAttachments.url,
      fileName: forumAttachments.fileName,
      contentType: forumAttachments.contentType,
      sizeBytes: forumAttachments.sizeBytes,
    })
    .from(forumAttachments)
    .where(eq(forumAttachments.postId, postId))
    .orderBy(asc(forumAttachments.position), asc(forumAttachments.createdAt));
  return rows.map((r) => ({ ...r, kind: r.kind === "link" ? "link" : "file" }));
}

export type CommentView = {
  id: string;
  author: string;
  isAdmin: boolean;
  mine: boolean;
  body: string;
  createdAt: Date;
  hidden: boolean;
  isNew: boolean;
};

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

// Los pacientes ven solo el nombre de pila de quien comentó y nunca los comentarios ocultos.
// El recorte se hace acá, en el servidor, para que el apellido no llegue al navegador de otro paciente.
export async function listComments(postId: string, viewer: { id: string; role: "admin" | "patient" }): Promise<CommentView[]> {
  const rows = await db
    .select({
      id: forumComments.id,
      userId: forumComments.userId,
      name: users.name,
      role: users.role,
      body: forumComments.body,
      createdAt: forumComments.createdAt,
      hiddenAt: forumComments.hiddenAt,
      adminSeenAt: forumComments.adminSeenAt,
    })
    .from(forumComments)
    .innerJoin(users, eq(users.id, forumComments.userId))
    .where(viewer.role === "admin" ? eq(forumComments.postId, postId) : and(eq(forumComments.postId, postId), isNull(forumComments.hiddenAt)))
    .orderBy(asc(forumComments.createdAt));
  return rows.map((r) => ({
    id: r.id,
    author: viewer.role === "admin" ? r.name : firstName(r.name),
    isAdmin: r.role === "admin",
    mine: r.userId === viewer.id,
    body: r.body,
    createdAt: r.createdAt,
    hidden: r.hiddenAt !== null,
    // "Nuevo" es un aviso solo para la administradora; los pacientes nunca lo ven.
    isNew: viewer.role === "admin" && r.role === "patient" && r.hiddenAt === null && r.adminSeenAt === null,
  }));
}

// Comentarios de pacientes que la administradora todavía no vio (para el aviso del menú).
export async function countNewComments(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(forumComments)
    .innerJoin(users, eq(users.id, forumComments.userId))
    .where(and(isNull(forumComments.hiddenAt), isNull(forumComments.adminSeenAt), eq(users.role, "patient")));
  return row?.n ?? 0;
}

export async function getFileAttachment(id: string) {
  const [row] = await db
    .select({
      storageKey: forumAttachments.storageKey,
      fileName: forumAttachments.fileName,
      contentType: forumAttachments.contentType,
    })
    .from(forumAttachments)
    .where(and(eq(forumAttachments.id, id), eq(forumAttachments.kind, "file"), isNotNull(forumAttachments.storageKey)))
    .limit(1);
  return row ?? null;
}

export async function forumStorageUsage(): Promise<{ files: number; bytes: number }> {
  const [row] = await db
    .select({ files: count(), bytes: sql<number>`coalesce(sum(${forumAttachments.sizeBytes}), 0)::float8` })
    .from(forumAttachments)
    .where(eq(forumAttachments.kind, "file"));
  return { files: row?.files ?? 0, bytes: Number(row?.bytes ?? 0) };
}
