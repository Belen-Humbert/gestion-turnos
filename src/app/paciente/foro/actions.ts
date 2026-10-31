"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { forumComments } from "@/db/schema";
import { createComment } from "@/lib/forum/comments";
import { requireUser } from "@/lib/session";

export type CommentFormState = { error?: string; ok?: string; body?: string } | undefined;

export async function addComment(_prev: CommentFormState, formData: FormData): Promise<CommentFormState> {
  const user = await requireUser("patient");
  const postId = formData.get("postId");
  const raw = typeof formData.get("body") === "string" ? String(formData.get("body")) : "";
  const res = await createComment(user, postId, raw);
  if ("error" in res) return { error: res.error, body: raw };
  revalidatePath(`/paciente/foro/${String(postId)}`);
  revalidatePath("/admin", "layout");
  return { ok: "Comentario publicado." };
}

// Cada paciente puede borrar solo sus propios comentarios.
export async function deleteOwnComment(formData: FormData) {
  const user = await requireUser("patient");
  const id = z.string().uuid().safeParse(formData.get("commentId"));
  if (!id.success) return;
  const [row] = await db
    .delete(forumComments)
    .where(and(eq(forumComments.id, id.data), eq(forumComments.userId, user.id)))
    .returning({ postId: forumComments.postId });
  if (!row) return;
  revalidatePath(`/paciente/foro/${row.postId}`);
  revalidatePath("/admin", "layout");
}
