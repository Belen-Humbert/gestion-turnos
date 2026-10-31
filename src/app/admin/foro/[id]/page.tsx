import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AttachmentList } from "@/components/forum/attachments";
import { CommentsSection } from "@/components/forum/comments";
import { ConfirmForm } from "@/components/forum/confirm-form";
import { MarkSeen } from "@/components/forum/mark-seen";
import { formatDate } from "@/lib/dates";
import { getPost, listAttachments, listComments } from "@/lib/forum/queries";
import { requireUser } from "@/lib/session";
import { adminComment, deleteComment, deletePost, markCommentsSeen, setCommentHidden, setCommentsOpen } from "../actions";

export const metadata: Metadata = { title: "Publicación" };

const AVISOS: Record<string, { tone: "ok" | "warn"; text: (n: number) => string }> = {
  ok: { tone: "ok", text: (n) => `Aviso enviado a ${n} ${n === 1 ? "paciente" : "pacientes"}.` },
  sim: { tone: "warn", text: () => "No se envió ningún aviso real: falta configurar el email o las notificaciones del servidor." },
  nadie: { tone: "warn", text: () => "No hay pacientes para avisar: ninguno tiene activados los avisos del foro por email o notificación." },
  dup: { tone: "warn", text: () => "Ya se había enviado un aviso hace instantes." },
  err: { tone: "warn", text: () => "La publicación se guardó, pero el aviso no se pudo enviar. Probá de nuevo desde Editar." },
};

export default async function Page({ params, searchParams }: PageProps<"/admin/foro/[id]">) {
  const user = await requireUser("admin");
  const { id } = await params;
  const sp = await searchParams;
  const avisoKey = typeof sp.aviso === "string" ? sp.aviso : "";
  const aviso = AVISOS[avisoKey];
  const avisoN = Number(typeof sp.n === "string" ? sp.n : 0) || 0;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const post = await getPost(id);
  if (!post) notFound();
  const [attachments, comments] = await Promise.all([listAttachments(id), listComments(id, user)]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <MarkSeen action={markCommentsSeen} postId={id} pending={comments.some((c) => c.isNew)} />
      <Link href="/admin/foro" className="text-sm font-extrabold text-verde underline">← Volver al foro</Link>

      {aviso ? (
        <p role="status" data-aviso={avisoKey} className={`rounded-xl px-4 py-3 text-sm font-bold ${aviso.tone === "ok" ? "bg-[#e6f4ea] text-verde-oscuro" : "bg-[#fff4d6] text-[#7a5a00]"}`}>
          {aviso.text(avisoN)}
        </p>
      ) : null}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-extrabold">{post.title}</h1>
          <p className="mt-1 text-sm font-bold text-suave">
            {formatDate(post.createdAt)}
            {post.notifiedAt ? ` · Avisaste a los pacientes el ${formatDate(post.notifiedAt)}` : ""}
          </p>
        </div>
        <Link href={`/admin/foro/${id}/editar`} className="flex min-h-11 items-center rounded-xl border-[1.5px] border-borde px-4 text-sm font-extrabold hover:bg-fondo">
          Editar
        </Link>
      </header>

      {post.body ? <p className="whitespace-pre-wrap break-words rounded-[22px] border border-borde bg-white p-6 text-[15px] font-semibold leading-relaxed">{post.body}</p> : null}
      <AttachmentList attachments={attachments} />

      <form action={setCommentsOpen} className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-borde bg-white p-5">
        <input type="hidden" name="postId" value={id} />
        <input type="hidden" name="open" value={post.commentsOpen ? "0" : "1"} />
        <p className="text-sm font-bold">{post.commentsOpen ? "Los pacientes pueden comentar." : "Comentarios cerrados: los pacientes ya no pueden comentar."}</p>
        <button type="submit" className="min-h-11 rounded-xl border-[1.5px] border-borde px-4 text-sm font-extrabold hover:bg-fondo">
          {post.commentsOpen ? "Cerrar comentarios" : "Abrir comentarios"}
        </button>
      </form>

      <CommentsSection
        postId={id}
        comments={comments}
        viewer="admin"
        commentsOpen={post.commentsOpen}
        commentAction={adminComment}
        moderation={{ setHidden: setCommentHidden, remove: deleteComment }}
      />

      <section aria-label="Eliminar publicación" className="rounded-[22px] border border-borde bg-white p-6">
        <h2 className="mb-1 text-lg font-extrabold">Eliminar publicación</h2>
        <p className="mb-4 text-sm font-semibold text-suave">Se borran también sus archivos y comentarios. No se puede deshacer.</p>
        <ConfirmForm action={deletePost} message="¿Eliminar esta publicación con sus archivos y comentarios?">
          <input type="hidden" name="postId" value={id} />
          <button type="submit" className="min-h-12 w-full rounded-2xl border-[1.5px] border-error px-6 text-base font-extrabold text-error hover:bg-[#fbe9e9]">
            Eliminar publicación
          </button>
        </ConfirmForm>
      </section>
    </div>
  );
}
