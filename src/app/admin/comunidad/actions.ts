"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { communityPosts } from "@/db/schema";
import { addOneMonth, NOTE_MAX, validatePost } from "@/lib/community/rules";
import { requireUser } from "@/lib/session";

const refresh = () => {
  revalidatePath("/admin/comunidad");
  revalidatePath("/admin", "layout");
  revalidatePath("/paciente", "layout");
};

// Ana aprueba: desde ese momento la publicación se ve durante un mes.
export async function approvePost(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const now = new Date();
  await db
    .update(communityPosts)
    .set({ status: "approved", approvedAt: now, expiresAt: addOneMonth(now), moderatorNote: null, authorSeenAt: null, updatedAt: now })
    .where(eq(communityPosts.id, id.data));
  refresh();
}

export type ReviewState = { error?: string; ok?: string } | undefined;

// Ana pide modificaciones: el paciente ve su nota, corrige y vuelve a enviar.
export async function requestChanges(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  const note = String(formData.get("note") ?? "").trim();
  if (!id.success) return { error: "La publicación no existe." };
  if (note.length < 5) return { error: "Contale qué tiene que cambiar (al menos 5 caracteres)." };
  if (note.length > NOTE_MAX) return { error: `La nota es demasiado larga (máximo ${NOTE_MAX} caracteres).` };
  const updated = await db
    .update(communityPosts)
    .set({ status: "changes", moderatorNote: note, expiresAt: null, approvedAt: null, authorSeenAt: null, updatedAt: new Date() })
    .where(eq(communityPosts.id, id.data))
    .returning({ id: communityPosts.id });
  if (updated.length === 0) return { error: "La publicación no existe." };
  refresh();
  return { ok: "Se le pidieron modificaciones al paciente." };
}

// Una publicación vencida (o por vencer) vuelve a mostrarse un mes más.
export async function renewPost(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const now = new Date();
  await db
    .update(communityPosts)
    .set({ approvedAt: now, expiresAt: addOneMonth(now), updatedAt: now })
    .where(and(eq(communityPosts.id, id.data), eq(communityPosts.status, "approved")));
  refresh();
}

export async function removePost(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await db.delete(communityPosts).where(eq(communityPosts.id, id.data));
  refresh();
}

export type AdminPostState = { error?: string; values?: { title: string; description: string; link: string } } | undefined;

// Ana también publica: sus publicaciones salen aprobadas y duran un mes.
export async function createAdminPost(_prev: AdminPostState, formData: FormData): Promise<AdminPostState> {
  const user = await requireUser("admin");
  const raw = { title: formData.get("title"), description: formData.get("description"), link: formData.get("link") };
  const values = { title: String(raw.title ?? ""), description: String(raw.description ?? ""), link: String(raw.link ?? "") };
  const check = validatePost(raw);
  if (!check.ok) return { error: check.error, values };
  const now = new Date();
  await db.insert(communityPosts).values({
    authorId: user.id,
    ...check.value,
    status: "approved",
    approvedAt: now,
    expiresAt: addOneMonth(now),
    authorSeenAt: now,
  });
  refresh();
  redirect("/admin/comunidad?tab=publicadas");
}
