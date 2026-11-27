import "server-only";
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { libraryBooks, libraryComments, users } from "@/db/schema";
import type { CommentView } from "@/lib/forum/queries";

export type BookSummary = {
  id: string;
  title: string;
  author: string;
  lent: boolean;
  commentCount: number;
  newComments: number; // solo tiene sentido para Ana
};

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";

// Todos los libros, del más nuevo al más viejo. `q` busca en título y autor.
export async function listBooks(q = ""): Promise<BookSummary[]> {
  const term = q.trim().slice(0, 80);
  const like = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
  return db
    .select({
      id: libraryBooks.id,
      title: libraryBooks.title,
      author: libraryBooks.author,
      lent: sql<boolean>`${libraryBooks.lentAt} is not null`,
      commentCount: sql<number>`(select count(*)::int from library_comments c where c.book_id = library_books.id and c.hidden_at is null)`,
      newComments: sql<number>`(select count(*)::int from library_comments c join users u on u.id = c.user_id where c.book_id = library_books.id and c.hidden_at is null and c.admin_seen_at is null and u.role = 'patient')`,
    })
    .from(libraryBooks)
    .where(like ? sql`(library_books.title ilike ${like} or library_books.author ilike ${like})` : undefined)
    .orderBy(desc(libraryBooks.createdAt));
}

export async function getBook(id: string) {
  const [row] = await db
    .select({
      id: libraryBooks.id,
      title: libraryBooks.title,
      author: libraryBooks.author,
      coverKey: libraryBooks.coverKey,
      coverContentType: libraryBooks.coverContentType,
      lent: sql<boolean>`${libraryBooks.lentAt} is not null`,
      createdAt: libraryBooks.createdAt,
    })
    .from(libraryBooks)
    .where(eq(libraryBooks.id, id))
    .limit(1);
  return row ?? null;
}

// Los pacientes ven solo el nombre de pila de quien comentó y nunca los comentarios ocultos
// (ni las respuestas a un comentario oculto). El recorte se hace en el servidor.
export async function listBookComments(
  bookId: string,
  viewer: { id: string; role: "admin" | "patient" },
): Promise<CommentView[]> {
  const rows = await db
    .select({
      id: libraryComments.id,
      userId: libraryComments.userId,
      name: users.name,
      role: users.role,
      body: libraryComments.body,
      createdAt: libraryComments.createdAt,
      hiddenAt: libraryComments.hiddenAt,
      adminSeenAt: libraryComments.adminSeenAt,
      parentId: libraryComments.parentId,
    })
    .from(libraryComments)
    .innerJoin(users, eq(users.id, libraryComments.userId))
    .where(
      viewer.role === "admin"
        ? eq(libraryComments.bookId, bookId)
        : and(eq(libraryComments.bookId, bookId), isNull(libraryComments.hiddenAt)),
    )
    .orderBy(asc(libraryComments.createdAt));
  const shown =
    viewer.role === "admin" ? rows : rows.filter((r) => !r.parentId || rows.some((x) => x.id === r.parentId));
  return shown.map((r) => ({
    id: r.id,
    author: viewer.role === "admin" || r.role === "admin" ? r.name : firstName(r.name),
    isAdmin: r.role === "admin",
    mine: r.userId === viewer.id,
    body: r.body,
    createdAt: r.createdAt,
    hidden: r.hiddenAt !== null,
    parentId: r.parentId,
    hearted: false,
    heartNew: false,
    replyNew: false,
    isNew: viewer.role === "admin" && r.role === "patient" && r.hiddenAt === null && r.adminSeenAt === null,
  }));
}

// Comentarios de pacientes en libros que Ana todavía no vio.
export async function countNewBookComments(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(libraryComments)
    .innerJoin(users, eq(users.id, libraryComments.userId))
    .where(and(isNull(libraryComments.hiddenAt), isNull(libraryComments.adminSeenAt), eq(users.role, "patient")));
  return row?.n ?? 0;
}
