"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { communityPosts } from "@/db/schema";
import { MAX_OPEN_PER_PATIENT, validatePost } from "@/lib/community/rules";
import { participationError } from "@/lib/participation";
import { requireUser } from "@/lib/session";

export type CommunityFormState = { error?: string; values?: { title: string; description: string; link: string } } | undefined;

const DAILY_LIMIT = 5;

// El paciente propone una publicación (o corrige una que Ana pidió modificar). Siempre queda pendiente de revisión.
export async function submitPost(_prev: CommunityFormState, formData: FormData): Promise<CommunityFormState> {
  const user = await requireUser("patient");
  const raw = { title: formData.get("title"), description: formData.get("description"), link: formData.get("link") };
  const values = { title: String(raw.title ?? ""), description: String(raw.description ?? ""), link: String(raw.link ?? "") };

  const blocked = await participationError(user, "community");
  if (blocked) return { error: blocked, values };
  const check = validatePost(raw);
  if (!check.ok) return { error: check.error, values };

  const idRaw = formData.get("id");
  const id = idRaw ? z.string().uuid().safeParse(idRaw) : null;
  if (id && !id.success) return { error: "La publicación no existe.", values };

  if (id) {
    // Solo se puede corregir lo propio que todavía no se publicó: una aprobada no se edita (volvería a saltearse la revisión).
    const updated = await db
      .update(communityPosts)
      .set({ ...check.value, status: "pending", moderatorNote: null, authorSeenAt: null, updatedAt: new Date() })
      .where(
        and(eq(communityPosts.id, id.data), eq(communityPosts.authorId, user.id), inArray(communityPosts.status, ["pending", "changes"])),
      )
      .returning({ id: communityPosts.id });
    if (updated.length === 0) return { error: "Esa publicación ya no se puede editar.", values };
  } else {
    const [open] = await db
      .select({ n: count() })
      .from(communityPosts)
      .where(and(eq(communityPosts.authorId, user.id), inArray(communityPosts.status, ["pending", "changes"])));
    if ((open?.n ?? 0) >= MAX_OPEN_PER_PATIENT) {
      return { error: `Ya tenés ${MAX_OPEN_PER_PATIENT} publicaciones esperando revisión. Esperá la respuesta de Ana antes de proponer otra.`, values };
    }
    const [today] = await db
      .select({ n: count() })
      .from(communityPosts)
      .where(and(eq(communityPosts.authorId, user.id), gt(communityPosts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))));
    if ((today?.n ?? 0) >= DAILY_LIMIT) return { error: "Hiciste muchas propuestas hoy. Probá de nuevo mañana.", values };
    await db.insert(communityPosts).values({ authorId: user.id, ...check.value });
  }
  revalidatePath("/paciente/comunidad");
  revalidatePath("/admin", "layout");
  redirect("/paciente/comunidad?enviada=1");
}

export async function deleteMyPost(formData: FormData) {
  const user = await requireUser("patient");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await db.delete(communityPosts).where(and(eq(communityPosts.id, id.data), eq(communityPosts.authorId, user.id)));
  revalidatePath("/paciente", "layout");
  revalidatePath("/admin", "layout");
}
