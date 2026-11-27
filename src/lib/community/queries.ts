import "server-only";
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { communityPosts, users } from "@/db/schema";
import { authorLabel } from "@/lib/author-label";

export type CommunityPostView = {
  id: string;
  title: string;
  description: string;
  link: string | null;
  status: "pending" | "changes" | "approved";
  moderatorNote: string | null;
  author: string; // ya recortado según quién mira
  mine: boolean;
  isAdmin: boolean;
  approvedAt: Date | null;
  expiresAt: Date | null;
  expired: boolean;
  createdAt: Date;
  authorSeen: boolean;
};

const cols = {
  id: communityPosts.id,
  title: communityPosts.title,
  description: communityPosts.description,
  link: communityPosts.link,
  status: communityPosts.status,
  moderatorNote: communityPosts.moderatorNote,
  authorId: communityPosts.authorId,
  approvedAt: communityPosts.approvedAt,
  expiresAt: communityPosts.expiresAt,
  authorSeenAt: communityPosts.authorSeenAt,
  createdAt: communityPosts.createdAt,
  name: users.name,
  alias: users.alias,
  role: users.role,
};

type Row = {
  id: string;
  title: string;
  description: string;
  link: string | null;
  status: "pending" | "changes" | "approved";
  moderatorNote: string | null;
  authorId: string;
  approvedAt: Date | null;
  expiresAt: Date | null;
  authorSeenAt: Date | null;
  createdAt: Date;
  name: string;
  alias: string | null;
  role: "admin" | "patient";
};

function toView(r: Row, viewer: { id: string; role: "admin" | "patient" }, now = new Date()): CommunityPostView {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    link: r.link,
    status: r.status,
    // La nota de Ana la ve solo quien escribió la publicación (y Ana).
    moderatorNote: viewer.role === "admin" || r.authorId === viewer.id ? r.moderatorNote : null,
    author: authorLabel(viewer.role, { role: r.role, name: r.name, alias: r.alias }),
    mine: r.authorId === viewer.id,
    isAdmin: r.role === "admin",
    approvedAt: r.approvedAt,
    expiresAt: r.expiresAt,
    expired: r.status === "approved" && r.expiresAt !== null && r.expiresAt.getTime() <= now.getTime(),
    createdAt: r.createdAt,
    authorSeen: r.authorSeenAt !== null,
  };
}

// Lo que ve cualquier paciente: publicaciones aprobadas que todavía no vencieron (duran un mes).
export async function listActivePosts(viewer: { id: string; role: "admin" | "patient" }): Promise<CommunityPostView[]> {
  const now = new Date();
  const rows = await db
    .select(cols)
    .from(communityPosts)
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .where(and(eq(communityPosts.status, "approved"), gt(communityPosts.expiresAt, now)))
    .orderBy(desc(communityPosts.approvedAt));
  return rows.map((r) => toView(r, viewer, now));
}

// Las publicaciones del propio paciente, en cualquier estado.
export async function listMyPosts(viewer: { id: string; role: "admin" | "patient" }): Promise<CommunityPostView[]> {
  const rows = await db
    .select(cols)
    .from(communityPosts)
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .where(eq(communityPosts.authorId, viewer.id))
    .orderBy(desc(communityPosts.createdAt));
  return rows.map((r) => toView(r, viewer));
}

export type AdminTab = "pendientes" | "cambios" | "publicadas" | "vencidas";

// Panel de Ana, con la identidad real y el nombre de usuario de cada autor.
export async function listPostsForAdmin(tab: AdminTab, viewer: { id: string; role: "admin" }): Promise<CommunityPostView[]> {
  const now = new Date();
  const where =
    tab === "pendientes"
      ? eq(communityPosts.status, "pending")
      : tab === "cambios"
        ? eq(communityPosts.status, "changes")
        : tab === "publicadas"
          ? and(eq(communityPosts.status, "approved"), gt(communityPosts.expiresAt, now))
          : and(eq(communityPosts.status, "approved"), lte(communityPosts.expiresAt, now));
  const rows = await db
    .select(cols)
    .from(communityPosts)
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .where(where)
    .orderBy(tab === "pendientes" ? communityPosts.createdAt : desc(communityPosts.updatedAt));
  return rows.map((r) => toView(r, viewer, now));
}

export async function adminCounts(): Promise<{ pendientes: number; cambios: number; publicadas: number; vencidas: number }> {
  const now = new Date();
  const [row] = await db
    .select({
      pendientes: sql<number>`count(*) filter (where ${communityPosts.status} = 'pending')::int`,
      cambios: sql<number>`count(*) filter (where ${communityPosts.status} = 'changes')::int`,
      publicadas: sql<number>`count(*) filter (where ${communityPosts.status} = 'approved' and ${communityPosts.expiresAt} > ${now})::int`,
      vencidas: sql<number>`count(*) filter (where ${communityPosts.status} = 'approved' and ${communityPosts.expiresAt} <= ${now})::int`,
    })
    .from(communityPosts);
  return row ?? { pendientes: 0, cambios: 0, publicadas: 0, vencidas: 0 };
}

export async function getPost(id: string) {
  const [row] = await db.select().from(communityPosts).where(eq(communityPosts.id, id)).limit(1);
  return row ?? null;
}

// Para el menú de Ana: publicaciones esperando revisión.
export async function countPendingPosts(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(communityPosts).where(eq(communityPosts.status, "pending"));
  return row?.n ?? 0;
}

// Para el menú del paciente: decisiones de Ana que todavía no vio (aprobada o con cambios pedidos).
export async function countPatientCommunityNews(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(communityPosts)
    .where(
      and(
        eq(communityPosts.authorId, userId),
        isNull(communityPosts.authorSeenAt),
        or(eq(communityPosts.status, "changes"), and(eq(communityPosts.status, "approved"), isNotNull(communityPosts.approvedAt))),
      ),
    );
  return row?.n ?? 0;
}

// Al abrir la Comunidad, el paciente «ve» las decisiones de Ana y se apaga el aviso del menú.
export async function markMyPostsSeen(userId: string) {
  await db
    .update(communityPosts)
    .set({ authorSeenAt: new Date() })
    .where(and(eq(communityPosts.authorId, userId), isNull(communityPosts.authorSeenAt), inArray(communityPosts.status, ["changes", "approved"])));
}
