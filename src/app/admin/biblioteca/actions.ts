"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { libraryBooks, libraryComments, users } from "@/db/schema";
import { isValidStorageKey, classifyFile } from "@/lib/forum/files";
import { createBookComment } from "@/lib/library/comments";
import { AUTHOR_MAX, TITLE_MAX, validateCover } from "@/lib/library/covers";
import { requireUser } from "@/lib/session";
import { getStorage, type UploadTarget } from "@/lib/storage";

export type PreparedCover =
  | { ok: true; key: string; fileName: string; contentType: string; size: number; target: UploadTarget }
  | { ok: false; error: string };

// Paso 1 de la subida de la portada: se valida la foto y el navegador la sube directo al almacenamiento.
export async function prepareCoverUpload(file: { name: string; size: number }): Promise<PreparedCover> {
  await requireUser("admin");
  const check = validateCover({ name: String(file?.name ?? ""), size: Number(file?.size) });
  if (!check.ok) return check;
  const key = `library/${randomUUID()}.${check.ext}`;
  const target = await getStorage().createUploadTarget({ key, contentType: check.mime, size: Number(file.size) });
  return { ok: true, key, fileName: check.fileName, contentType: check.mime, size: Number(file.size), target };
}

// Si Ana cambia de foto antes de guardar, la que había subido se borra del almacenamiento.
export async function discardCover(key: string): Promise<void> {
  await requireUser("admin");
  if (!isValidStorageKey(key) || !key.startsWith("library/")) return;
  const [used] = await db.select({ id: libraryBooks.id }).from(libraryBooks).where(eq(libraryBooks.coverKey, key)).limit(1);
  if (!used) await getStorage().remove([key]).catch(() => {});
}

export type BookFormState = { error?: string; ok?: string; values?: { title: string; author: string } } | undefined;

const bookSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1, "Escribí el título.").max(TITLE_MAX, `El título es demasiado largo (máximo ${TITLE_MAX} caracteres).`),
  author: z.string().trim().min(1, "Escribí el autor.").max(AUTHOR_MAX, `El autor es demasiado largo (máximo ${AUTHOR_MAX} caracteres).`),
  coverKey: z.string().optional(),
});

export async function saveBook(_prev: BookFormState, formData: FormData): Promise<BookFormState> {
  await requireUser("admin");
  const raw = {
    id: formData.get("id") || undefined,
    title: formData.get("title") ?? "",
    author: formData.get("author") ?? "",
    coverKey: String(formData.get("coverKey") ?? "") || undefined,
  };
  const values = { title: String(raw.title), author: String(raw.author) };
  const parsed = bookSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos.", values };
  const { id, title, author, coverKey } = parsed.data;

  const storage = getStorage();
  let cover: { key: string; contentType: string } | null = null;
  if (coverKey) {
    if (!isValidStorageKey(coverKey) || !coverKey.startsWith("library/")) return { error: "La portada no es válida. Elegí la foto de nuevo.", values };
    if (!(await storage.stat(coverKey))) return { error: "La foto de la portada no se terminó de subir. Elegila de nuevo.", values };
    const [taken] = await db.select({ id: libraryBooks.id }).from(libraryBooks).where(eq(libraryBooks.coverKey, coverKey)).limit(1);
    if (taken && taken.id !== id) return { error: "Esa portada ya está en otro libro.", values };
    cover = { key: coverKey, contentType: classifyFile(coverKey)?.mime ?? "image/jpeg" };
  }

  if (!id) {
    if (!cover) return { error: "Subí la foto de la portada.", values };
    const [book] = await db
      .insert(libraryBooks)
      .values({ title, author, coverKey: cover.key, coverContentType: cover.contentType })
      .returning({ id: libraryBooks.id });
    revalidatePath("/admin/biblioteca");
    revalidatePath("/paciente/biblioteca");
    redirect(`/admin/biblioteca/${book.id}`);
  }

  const [current] = await db.select({ coverKey: libraryBooks.coverKey }).from(libraryBooks).where(eq(libraryBooks.id, id)).limit(1);
  if (!current) return { error: "El libro no existe.", values };
  await db
    .update(libraryBooks)
    .set({
      title,
      author,
      updatedAt: new Date(),
      ...(cover ? { coverKey: cover.key, coverContentType: cover.contentType } : {}),
    })
    .where(eq(libraryBooks.id, id));
  if (cover && current.coverKey !== cover.key) await storage.remove([current.coverKey]).catch(() => {});
  revalidatePath("/admin/biblioteca");
  revalidatePath(`/admin/biblioteca/${id}`);
  revalidatePath("/paciente/biblioteca");
  revalidatePath(`/paciente/biblioteca/${id}`);
  return { ok: "Libro guardado.", values };
}

// Disponible ↔ prestado.
export async function setLent(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const lent = formData.get("lent") === "1";
  await db.update(libraryBooks).set({ lentAt: lent ? new Date() : null }).where(eq(libraryBooks.id, id.data));
  revalidatePath("/admin/biblioteca");
  revalidatePath(`/admin/biblioteca/${id.data}`);
  revalidatePath("/paciente/biblioteca");
  revalidatePath(`/paciente/biblioteca/${id.data}`);
}

export async function deleteBook(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const [book] = await db.delete(libraryBooks).where(eq(libraryBooks.id, id.data)).returning({ coverKey: libraryBooks.coverKey });
  if (book) await getStorage().remove([book.coverKey]).catch(() => {});
  revalidatePath("/admin", "layout");
  revalidatePath("/paciente/biblioteca");
  redirect("/admin/biblioteca");
}

// --- Comentarios (Ana) ---------------------------------------------------------------------

export async function addBookComment(
  _prev: { error?: string; ok?: string; body?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: string; body?: string } | undefined> {
  const user = await requireUser("admin");
  const bookId = formData.get("postId");
  const raw = typeof formData.get("body") === "string" ? String(formData.get("body")) : "";
  const res = await createBookComment(user, bookId, raw, formData.get("parentId"));
  if ("error" in res) return { error: res.error, body: raw };
  revalidatePath(`/admin/biblioteca/${String(bookId)}`);
  revalidatePath(`/paciente/biblioteca/${String(bookId)}`);
  return { ok: "Comentario publicado." };
}

export async function setBookCommentHidden(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("commentId"));
  if (!id.success) return;
  const hide = formData.get("hide") === "1";
  const [row] = await db
    .update(libraryComments)
    .set({ hiddenAt: hide ? new Date() : null })
    .where(eq(libraryComments.id, id.data))
    .returning({ bookId: libraryComments.bookId });
  if (!row) return;
  revalidatePath(`/admin/biblioteca/${row.bookId}`);
  revalidatePath(`/paciente/biblioteca/${row.bookId}`);
  revalidatePath("/admin", "layout");
}

export async function removeBookComment(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("commentId"));
  if (!id.success) return;
  const [row] = await db.delete(libraryComments).where(eq(libraryComments.id, id.data)).returning({ bookId: libraryComments.bookId });
  if (!row) return;
  revalidatePath(`/admin/biblioteca/${row.bookId}`);
  revalidatePath(`/paciente/biblioteca/${row.bookId}`);
  revalidatePath("/admin", "layout");
}

// Al abrir un libro, Ana «ve» sus comentarios nuevos: se apagan los avisos.
export async function markBookSeen(bookId: string) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(bookId);
  if (!id.success) return;
  await db
    .update(libraryComments)
    .set({ adminSeenAt: new Date() })
    .where(
      and(
        eq(libraryComments.bookId, id.data),
        isNull(libraryComments.adminSeenAt),
        sql`${libraryComments.userId} in (select id from ${users} where role = 'patient')`,
      ),
    );
  revalidatePath("/admin", "layout");
}
