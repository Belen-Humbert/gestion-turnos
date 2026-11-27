"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { libraryComments } from "@/db/schema";
import { createBookComment } from "@/lib/library/comments";
import { requireUser } from "@/lib/session";

export async function addBookComment(
  _prev: { error?: string; ok?: string; body?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: string; body?: string } | undefined> {
  const user = await requireUser("patient");
  const bookId = formData.get("postId");
  const raw = typeof formData.get("body") === "string" ? String(formData.get("body")) : "";
  const res = await createBookComment(user, bookId, raw, formData.get("parentId"));
  if ("error" in res) return { error: res.error, body: raw };
  revalidatePath(`/paciente/biblioteca/${String(bookId)}`);
  revalidatePath("/admin", "layout");
  return { ok: "Comentario publicado." };
}

// Cada paciente puede borrar solo sus propios comentarios.
export async function deleteOwnBookComment(formData: FormData) {
  const user = await requireUser("patient");
  const id = z.string().uuid().safeParse(formData.get("commentId"));
  if (!id.success) return;
  const [row] = await db
    .delete(libraryComments)
    .where(and(eq(libraryComments.id, id.data), eq(libraryComments.userId, user.id)))
    .returning({ bookId: libraryComments.bookId });
  if (!row) return;
  revalidatePath(`/paciente/biblioteca/${row.bookId}`);
  revalidatePath(`/admin/biblioteca/${row.bookId}`);
  revalidatePath("/admin", "layout");
}
