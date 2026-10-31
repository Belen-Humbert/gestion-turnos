"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { forumComments, users } from "@/db/schema";
import { createComment } from "@/lib/forum/comments";
import { requireUser } from "@/lib/session";

export type CommentFormState = { error?: string; ok?: string; body?: string } | undefined;

export async function addComment(_prev: CommentFormState, formData: FormData): Promise<CommentFormState> {
  const user = await requireUser("patient");
  const postId = formData.get("postId");
  const raw = typeof formData.get("body") === "string" ? String(formData.get("body")) : "";
  const res = await createComment(user, postId, raw, formData.get("parentId"));
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

// Al abrir la publicación, la paciente "ve" los corazones y respuestas de Ana: se apaga el aviso del menú.
export async function markMineSeen(postId: string) {
  const user = await requireUser("patient");
  const id = z.string().uuid().safeParse(postId);
  if (!id.success) return;
  const now = new Date();
  const mine = await db.select({ id: forumComments.id }).from(forumComments).where(and(eq(forumComments.postId, id.data), eq(forumComments.userId, user.id)));
  const hearts = await db
    .update(forumComments)
    .set({ ownerSeenAt: now })
    .where(and(eq(forumComments.postId, id.data), eq(forumComments.userId, user.id), isNotNull(forumComments.adminHeartedAt), isNull(forumComments.ownerSeenAt)))
    .returning({ id: forumComments.id });
  const replies = mine.length
    ? await db
        .update(forumComments)
        .set({ ownerSeenAt: now })
        .where(
          and(
            eq(forumComments.postId, id.data),
            inArray(forumComments.parentId, mine.map((m) => m.id)),
            isNull(forumComments.ownerSeenAt),
            inArray(forumComments.userId, db.select({ id: users.id }).from(users).where(eq(users.role, "admin"))),
          ),
        )
        .returning({ id: forumComments.id })
    : [];
  if (hearts.length + replies.length) revalidatePath("/paciente", "layout");
}
