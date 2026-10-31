import "server-only";
import { and, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { forumComments, forumPosts } from "@/db/schema";

import { COMMENT_MAX } from "./limits";
export { COMMENT_MAX };
const RATE_LIMIT = 5; // comentarios por paciente...
const RATE_WINDOW_MS = 2 * 60 * 1000; // ...cada 2 minutos

const bodySchema = z.string().trim().min(1, "Escribí tu comentario.").max(COMMENT_MAX, `El comentario es demasiado largo (máximo ${COMMENT_MAX} caracteres).`);

export type CommentResult = { error: string } | { ok: true };

export async function createComment(user: { id: string; role: "admin" | "patient" }, postId: unknown, rawBody: unknown, parent?: unknown): Promise<CommentResult> {
  const id = z.string().uuid().safeParse(postId);
  if (!id.success) return { error: "La publicación no existe." };
  const body = bodySchema.safeParse(typeof rawBody === "string" ? rawBody : "");
  if (!body.success) return { error: body.error.issues[0]?.message ?? "Comentario inválido." };

  const [post] = await db.select({ commentsOpen: forumPosts.commentsOpen }).from(forumPosts).where(eq(forumPosts.id, id.data)).limit(1);
  if (!post) return { error: "La publicación no existe." };
  if (user.role === "patient") {
    if (!post.commentsOpen) return { error: "Los comentarios de esta publicación están cerrados." };
    const [recent] = await db
      .select({ n: count() })
      .from(forumComments)
      .where(and(eq(forumComments.userId, user.id), gt(forumComments.createdAt, new Date(Date.now() - RATE_WINDOW_MS))));
    if ((recent?.n ?? 0) >= RATE_LIMIT) return { error: "Estás comentando muy rápido. Probá de nuevo en un par de minutos." };
  }

  // Respuestas: un solo nivel. Responder a una respuesta cuelga del comentario original.
  let parentId: string | null = null;
  if (parent !== undefined && parent !== null && parent !== "") {
    const pid = z.string().uuid().safeParse(parent);
    if (!pid.success) return { error: "El comentario que querés responder no existe." };
    const [target] = await db
      .select({ id: forumComments.id, postId: forumComments.postId, parentId: forumComments.parentId, hiddenAt: forumComments.hiddenAt })
      .from(forumComments)
      .where(eq(forumComments.id, pid.data))
      .limit(1);
    if (!target || target.postId !== id.data || (user.role === "patient" && target.hiddenAt)) return { error: "El comentario que querés responder no existe." };
    parentId = target.parentId ?? target.id;
    if (user.role === "patient") {
      // Los pacientes solo continúan la conversación con Ana en sus propios comentarios.
      const [root] = await db.select({ userId: forumComments.userId }).from(forumComments).where(eq(forumComments.id, parentId)).limit(1);
      if (!root || root.userId !== user.id) return { error: "Solo podés responder en tus propios comentarios." };
    }
  }
  await db.insert(forumComments).values({
    parentId,
    postId: id.data,
    userId: user.id,
    body: body.data,
    // Lo que escribe la administradora no cuenta como "nuevo" para ella.
    adminSeenAt: user.role === "admin" ? new Date() : null,
  });
  return { ok: true };
}
