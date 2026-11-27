import "server-only";
import { and, asc, count, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { authorLabel } from "@/lib/author-label";
import { attachmentGroup, type ForumFilter } from "./filters";
import { db } from "@/db";
import {
  forumAttachments,
  forumComments,
  forumPosts,
  users,
} from "@/db/schema";

export type PostSummary = {
  id: string;
  title: string;
  body: string;
  commentsOpen: boolean;
  createdAt: Date;
  attachmentCount: number;
  commentCount: number;
  newComments: number; // solo tiene sentido para la administradora
  groups: ForumFilter[]; // tipos de material que tiene la publicación
};

function likePattern(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Publicaciones, de la más nueva a la más vieja. `filters`: tipos de material; con match "any" alcanza con que tenga uno, con "all" tienen que estar todos.
// `q`: busca en el título, el texto y los nombres de los adjuntos.
export async function listPosts(
  filters: ForumFilter[] = [],
  q = "",
  match: "any" | "all" = "any",
): Promise<PostSummary[]> {
  const term = q.trim().slice(0, 80);
  const like = term ? likePattern(term) : null;
  const rows = await db
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
      kinds: sql<
        string[]
      >`(select coalesce(array_agg(distinct a.kind || '|' || coalesce(a.content_type, '') || '|' || coalesce(a.url, '')), '{}') from forum_attachments a where a.post_id = forum_posts.id)`,
    })
    .from(forumPosts)
    .where(
      like
        ? sql`(forum_posts.title ilike ${like} or forum_posts.body ilike ${like} or exists (select 1 from forum_attachments a where a.post_id = forum_posts.id and (a.label ilike ${like} or a.file_name ilike ${like} or a.url ilike ${like})))`
        : undefined,
    )
    .orderBy(desc(forumPosts.createdAt));
  const all = rows.map(({ kinds, ...r }) => ({
    ...r,
    groups: [
      ...new Set(
        (kinds ?? []).map((k) => {
          const [kind, type, ...url] = k.split("|");
          return attachmentGroup(kind, type || null, url.join("|") || null);
        }),
      ),
    ],
  }));
  if (!filters.length) return all;
  return all.filter((p) =>
    match === "all"
      ? filters.every((f) => p.groups.includes(f))
      : filters.some((f) => p.groups.includes(f)),
  );
}

export async function getPost(id: string) {
  const [row] = await db
    .select()
    .from(forumPosts)
    .where(eq(forumPosts.id, id))
    .limit(1);
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

export async function listAttachments(
  postId: string,
): Promise<AttachmentView[]> {
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
  parentId: string | null;
  hearted: boolean;
  // Solo para pacientes: Ana respondió o le dio corazón y todavía no lo vio.
  heartNew: boolean;
  replyNew: boolean;
};


// Los pacientes ven solo el nombre de pila de quien comentó y nunca los comentarios ocultos.
// El recorte se hace acá, en el servidor, para que el apellido no llegue al navegador de otro paciente.
export async function listComments(
  postId: string,
  viewer: { id: string; role: "admin" | "patient" },
): Promise<CommentView[]> {
  const rows = await db
    .select({
      id: forumComments.id,
      userId: forumComments.userId,
      name: users.name,
      alias: users.alias,
      role: users.role,
      body: forumComments.body,
      createdAt: forumComments.createdAt,
      hiddenAt: forumComments.hiddenAt,
      adminSeenAt: forumComments.adminSeenAt,
      parentId: forumComments.parentId,
      adminHeartedAt: forumComments.adminHeartedAt,
      ownerSeenAt: forumComments.ownerSeenAt,
    })
    .from(forumComments)
    .innerJoin(users, eq(users.id, forumComments.userId))
    .where(
      viewer.role === "admin"
        ? eq(forumComments.postId, postId)
        : and(eq(forumComments.postId, postId), isNull(forumComments.hiddenAt)),
    )
    .orderBy(asc(forumComments.createdAt));
  // Si un comentario está oculto para los pacientes, sus respuestas también.
  const shown =
    viewer.role === "admin"
      ? rows
      : rows.filter(
          (r) => !r.parentId || rows.some((x) => x.id === r.parentId),
        );
  return shown.map((r) => ({
    id: r.id,
    author: authorLabel(viewer.role, { role: r.role, name: r.name, alias: r.alias }),
    isAdmin: r.role === "admin",
    mine: r.userId === viewer.id,
    body: r.body,
    createdAt: r.createdAt,
    hidden: r.hiddenAt !== null,
    // "Nuevo" es un aviso solo para la administradora; los pacientes nunca lo ven.
    parentId: r.parentId,
    hearted: r.adminHeartedAt !== null,
    heartNew:
      viewer.role === "patient" &&
      r.userId === viewer.id &&
      r.adminHeartedAt !== null &&
      r.ownerSeenAt === null,
    replyNew:
      viewer.role === "patient" &&
      r.role === "admin" &&
      r.ownerSeenAt === null &&
      r.parentId !== null &&
      rows.some((x) => x.id === r.parentId && x.userId === viewer.id),
    isNew:
      viewer.role === "admin" &&
      r.role === "patient" &&
      r.hiddenAt === null &&
      r.adminSeenAt === null,
  }));
}

// Comentarios de pacientes que la administradora todavía no vio (para el aviso del menú).
export async function countNewComments(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(forumComments)
    .innerJoin(users, eq(users.id, forumComments.userId))
    .where(
      and(
        isNull(forumComments.hiddenAt),
        isNull(forumComments.adminSeenAt),
        eq(users.role, "patient"),
      ),
    );
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
    .where(
      and(
        eq(forumAttachments.id, id),
        eq(forumAttachments.kind, "file"),
        isNotNull(forumAttachments.storageKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function forumStorageUsage(): Promise<{
  files: number;
  bytes: number;
}> {
  const [row] = await db
    .select({
      files: count(),
      bytes: sql<number>`coalesce(sum(${forumAttachments.sizeBytes}), 0)::float8`,
    })
    .from(forumAttachments)
    .where(eq(forumAttachments.kind, "file"));
  return { files: row?.files ?? 0, bytes: Number(row?.bytes ?? 0) };
}

// Novedades para una paciente en el foro: corazones de Ana en sus comentarios y respuestas de Ana en sus hilos
// que todavía no vio. Alimenta el aviso del menú.
export async function countPatientForumNews(userId: string): Promise<number> {
  const root = alias(forumComments, "root");
  const [hearts] = await db
    .select({ n: count() })
    .from(forumComments)
    .where(
      and(
        eq(forumComments.userId, userId),
        isNull(forumComments.hiddenAt),
        isNotNull(forumComments.adminHeartedAt),
        isNull(forumComments.ownerSeenAt),
      ),
    );
  const [replies] = await db
    .select({ n: count() })
    .from(forumComments)
    .innerJoin(root, eq(root.id, forumComments.parentId))
    .innerJoin(users, eq(users.id, forumComments.userId))
    .where(
      and(
        eq(root.userId, userId),
        isNull(root.hiddenAt),
        eq(users.role, "admin"),
        isNull(forumComments.hiddenAt),
        isNull(forumComments.ownerSeenAt),
      ),
    );
  return (hearts?.n ?? 0) + (replies?.n ?? 0);
}
