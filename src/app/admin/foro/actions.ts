"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { forumAttachments, forumComments, forumPosts } from "@/db/schema";
import { notifyPatientsOfPost } from "@/lib/forum/notify";
import { createComment } from "@/lib/forum/comments";
import { classifyFile, displayFileName, isValidStorageKey, maxFileBytes, normalizeLink, validateUpload, type UploadCheck } from "@/lib/forum/files";
import { requireUser } from "@/lib/session";
import { getStorage, type UploadTarget } from "@/lib/storage";

export type ForumFormState = { error?: string; ok?: string; body?: string } | undefined;

// --- Subida de archivos ---------------------------------------------------------------------

export type PreparedUpload =
  | { ok: true; key: string; fileName: string; contentType: string; size: number; target: UploadTarget }
  | { ok: false; error: string };

// Paso 1 de una subida: el servidor valida el archivo y le da al navegador una dirección temporal
// para subirlo directamente. El archivo no pasa por un formulario del servidor.
export async function prepareUploads(files: { name: string; size: number }[]): Promise<PreparedUpload[]> {
  await requireUser("admin");
  if (!Array.isArray(files) || files.length === 0 || files.length > 10) return [{ ok: false, error: "Elegí hasta 10 archivos por vez." }];
  const max = maxFileBytes();
  const storage = getStorage();
  return Promise.all(
    files.map(async (f): Promise<PreparedUpload> => {
      const check: UploadCheck = validateUpload({ name: String(f?.name ?? ""), size: Number(f?.size) }, max);
      if (!check.ok) return check;
      const key = `forum/${randomUUID()}.${check.ext}`;
      const target = await storage.createUploadTarget({ key, contentType: check.mime, size: Number(f.size) });
      return { ok: true, key, fileName: check.fileName, contentType: check.mime, size: Number(f.size), target };
    }),
  );
}

// Si Ana quita un archivo que acaba de subir y todavía no publicó, se borra del almacenamiento.
export async function discardUpload(key: string): Promise<void> {
  await requireUser("admin");
  if (!isValidStorageKey(key)) return;
  const [used] = await db.select({ id: forumAttachments.id }).from(forumAttachments).where(eq(forumAttachments.storageKey, key)).limit(1);
  if (!used) await getStorage().remove([key]).catch(() => {});
}

// --- Publicaciones --------------------------------------------------------------------------

const newFileSchema = z.object({
  key: z.string().refine(isValidStorageKey),
  fileName: z.string().min(1).max(200),
  size: z.number().int().positive(),
});
const newLinkSchema = z.object({ label: z.string().trim().max(120), url: z.string().max(2000) });

const postSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Escribí un título.").max(120, "El título es demasiado largo (máximo 120 caracteres)."),
  body: z.string().trim().max(5000, "El texto es demasiado largo (máximo 5000 caracteres)."),
  files: z.array(newFileSchema).max(20),
  links: z.array(newLinkSchema).max(20),
  removeIds: z.array(z.string().uuid()).max(50),
});

function parseJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(typeof value === "string" && value ? value : "[]");
  } catch {
    return null;
  }
}

export async function savePost(_prev: ForumFormState, formData: FormData): Promise<ForumFormState> {
  await requireUser("admin");
  const parsed = postSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    files: parseJson(formData.get("files")),
    links: parseJson(formData.get("links")),
    removeIds: parseJson(formData.get("removeIds")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const data = parsed.data;

  // Enlaces: se normalizan y se rechaza cualquier cosa que no sea http/https.
  const links: { label: string; url: string }[] = [];
  for (const l of data.links) {
    if (!l.url.trim() && !l.label.trim()) continue;
    const url = normalizeLink(l.url);
    if (!url) return { error: `El enlace «${l.url.trim().slice(0, 60)}» no es válido. Tiene que empezar con http:// o https://.` };
    links.push({ label: l.label || url, url });
  }

  // Archivos: cada uno tiene que estar realmente en el almacenamiento y pesar lo declarado.
  const storage = getStorage();
  const max = maxFileBytes();
  const files: { key: string; fileName: string; contentType: string; size: number }[] = [];
  for (const f of data.files) {
    const type = classifyFile(f.key);
    const fileName = displayFileName(f.fileName);
    if (!type || classifyFile(fileName)?.mime !== type.mime) return { error: `«${fileName}» no es un tipo de archivo permitido.` };
    const stat = await storage.stat(f.key);
    if (!stat) return { error: `«${fileName}» no terminó de subirse. Volvé a intentarlo.` };
    if (stat.size !== f.size || stat.size > max) return { error: `«${fileName}» no coincide con lo que se subió. Volvé a intentarlo.` };
    files.push({ key: f.key, fileName, contentType: type.mime, size: stat.size });
  }
  if (files.length) {
    const dup = await db.select({ key: forumAttachments.storageKey }).from(forumAttachments).where(inArray(forumAttachments.storageKey, files.map((f) => f.key)));
    if (dup.length) return { error: "Uno de los archivos ya está en otra publicación." };
  }

  let postId = data.id;
  let removedKeys: string[] = [];
  if (postId) {
    const [exists] = await db.select({ id: forumPosts.id }).from(forumPosts).where(eq(forumPosts.id, postId)).limit(1);
    if (!exists) return { error: "La publicación no existe." };
    await db.update(forumPosts).set({ title: data.title, body: data.body, updatedAt: new Date() }).where(eq(forumPosts.id, postId));
    if (data.removeIds.length) {
      const gone = await db
        .delete(forumAttachments)
        .where(and(eq(forumAttachments.postId, postId), inArray(forumAttachments.id, data.removeIds)))
        .returning({ key: forumAttachments.storageKey });
      removedKeys = gone.map((g) => g.key).filter((k): k is string => Boolean(k));
    }
  } else {
    const [created] = await db.insert(forumPosts).values({ title: data.title, body: data.body }).returning({ id: forumPosts.id });
    postId = created.id;
  }

  let position = await db.$count(forumAttachments, eq(forumAttachments.postId, postId));
  const rows = [
    ...files.map((f) => ({ postId: postId!, kind: "file", label: f.fileName, fileName: f.fileName, storageKey: f.key, contentType: f.contentType, sizeBytes: f.size, position: position++ })),
    ...links.map((l) => ({ postId: postId!, kind: "link", label: l.label, url: l.url, position: position++ })),
  ];
  if (rows.length) await db.insert(forumAttachments).values(rows);
  if (removedKeys.length) await storage.remove(removedKeys).catch(() => {});

  revalidatePath("/admin/foro");
  revalidatePath("/paciente/foro");
  // Aviso opcional a los pacientes (la casilla viene sin tildar). Un fallo del aviso nunca pierde la publicación.
  if (formData.get("notify") === "1") {
    try {
      const r = await notifyPatientsOfPost(postId);
      const real = r.email + r.push;
      const state = r.skipped ? "dup" : real > 0 ? "ok" : r.simulated > 0 ? "sim" : r.errors > 0 ? "err" : "nadie";
      redirect(`/admin/foro/${postId}?aviso=${state}&n=${r.recipients}`);
    } catch (e) {
      if (isRedirectError(e)) throw e;
      redirect(`/admin/foro/${postId}?aviso=err&n=0`);
    }
  }
  redirect(`/admin/foro/${postId}`);
}

export async function deletePost(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("postId"));
  if (!id.success) return;
  const files = await db
    .select({ key: forumAttachments.storageKey })
    .from(forumAttachments)
    .where(and(eq(forumAttachments.postId, id.data), eq(forumAttachments.kind, "file")));
  await db.delete(forumPosts).where(eq(forumPosts.id, id.data));
  await getStorage()
    .remove(files.map((f) => f.key).filter((k): k is string => Boolean(k)))
    .catch(() => {});
  revalidatePath("/admin", "layout");
  revalidatePath("/paciente/foro");
  redirect("/admin/foro");
}

export async function setCommentsOpen(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("postId"));
  if (!id.success) return;
  await db.update(forumPosts).set({ commentsOpen: formData.get("open") === "1" }).where(eq(forumPosts.id, id.data));
  revalidatePath(`/admin/foro/${id.data}`);
  revalidatePath(`/paciente/foro/${id.data}`);
}

// --- Comentarios y moderación ---------------------------------------------------------------

export async function adminComment(_prev: ForumFormState, formData: FormData): Promise<ForumFormState> {
  const user = await requireUser("admin");
  const postId = formData.get("postId");
  const raw = typeof formData.get("body") === "string" ? String(formData.get("body")) : "";
  const res = await createComment(user, postId, raw, formData.get("parentId"));
  if ("error" in res) return { error: res.error, body: raw };
  revalidatePath(`/admin/foro/${String(postId)}`);
  revalidatePath(`/paciente/foro/${String(postId)}`);
  return { ok: "Comentario publicado." };
}

export async function toggleHeart(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("commentId"));
  if (!id.success) return;
  const on = formData.get("heart") === "1";
  const [row] = await db
    .update(forumComments)
    .set({ adminHeartedAt: on ? new Date() : null })
    .where(eq(forumComments.id, id.data))
    .returning({ postId: forumComments.postId });
  if (!row) return;
  revalidatePath(`/admin/foro/${row.postId}`);
  revalidatePath(`/paciente/foro/${row.postId}`);
}

export async function setCommentHidden(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("commentId"));
  if (!id.success) return;
  const hide = formData.get("hide") === "1";
  const [row] = await db
    .update(forumComments)
    .set({ hiddenAt: hide ? new Date() : null })
    .where(eq(forumComments.id, id.data))
    .returning({ postId: forumComments.postId });
  if (!row) return;
  revalidatePath("/admin", "layout");
  revalidatePath(`/paciente/foro/${row.postId}`);
}

export async function deleteComment(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("commentId"));
  if (!id.success) return;
  const [row] = await db.delete(forumComments).where(eq(forumComments.id, id.data)).returning({ postId: forumComments.postId });
  if (!row) return;
  revalidatePath("/admin", "layout");
  revalidatePath(`/paciente/foro/${row.postId}`);
}

export async function markCommentsSeen(postId: string) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(postId);
  if (!id.success) return;
  const done = await db
    .update(forumComments)
    .set({ adminSeenAt: new Date() })
    .where(and(eq(forumComments.postId, id.data)))
    .returning({ id: forumComments.id });
  if (done.length) revalidatePath("/admin", "layout");
}
