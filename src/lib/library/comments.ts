import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { libraryBooks, libraryComments } from "@/db/schema";
import { COMMENT_MAX } from "@/lib/forum/limits";
import { participationError } from "@/lib/participation";

const RATE_LIMIT = 5; // comentarios por paciente...
const RATE_WINDOW_MS = 2 * 60 * 1000; // ...cada 2 minutos

const bodySchema = z
  .string()
  .trim()
  .min(1, "Escribí tu comentario.")
  .max(COMMENT_MAX, `El comentario es demasiado largo (máximo ${COMMENT_MAX} caracteres).`);

export type BookCommentResult = { error: string } | { ok: true };

// Ana y los pacientes comentan y se responden entre sí. Las respuestas tienen un solo nivel:
// responder a una respuesta cuelga del comentario original.
export async function createBookComment(
  user: { id: string; role: "admin" | "patient" },
  bookId: unknown,
  rawBody: unknown,
  parent?: unknown,
): Promise<BookCommentResult> {
  const id = z.string().uuid().safeParse(bookId);
  if (!id.success) return { error: "El libro no existe." };
  const body = bodySchema.safeParse(typeof rawBody === "string" ? rawBody : "");
  if (!body.success) return { error: body.error.issues[0]?.message ?? "Comentario inválido." };

  const blocked = await participationError(user, "library");
  if (blocked) return { error: blocked };

  const [book] = await db.select({ id: libraryBooks.id }).from(libraryBooks).where(eq(libraryBooks.id, id.data)).limit(1);
  if (!book) return { error: "El libro no existe." };

  if (user.role === "patient") {
    const [recent] = await db
      .select({ n: count() })
      .from(libraryComments)
      .where(and(eq(libraryComments.userId, user.id), gt(libraryComments.createdAt, new Date(Date.now() - RATE_WINDOW_MS))));
    if ((recent?.n ?? 0) >= RATE_LIMIT) return { error: "Estás comentando muy rápido. Probá de nuevo en un par de minutos." };
  }

  let parentId: string | null = null;
  if (parent !== undefined && parent !== null && parent !== "") {
    const pid = z.string().uuid().safeParse(parent);
    if (!pid.success) return { error: "El comentario que querés responder no existe." };
    const [target] = await db
      .select({ id: libraryComments.id, bookId: libraryComments.bookId, parentId: libraryComments.parentId, hiddenAt: libraryComments.hiddenAt })
      .from(libraryComments)
      .where(eq(libraryComments.id, pid.data))
      .limit(1);
    if (!target || target.bookId !== id.data || (user.role === "patient" && target.hiddenAt)) {
      return { error: "El comentario que querés responder no existe." };
    }
    parentId = target.parentId ?? target.id;
  }

  await db.insert(libraryComments).values({
    bookId: id.data,
    userId: user.id,
    body: body.data,
    parentId,
    // Lo que escribe Ana no cuenta como «nuevo» para ella.
    adminSeenAt: user.role === "admin" ? new Date() : null,
  });
  return { ok: true };
}
