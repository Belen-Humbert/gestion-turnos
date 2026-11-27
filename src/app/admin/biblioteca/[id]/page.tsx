import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConfirmForm } from "@/components/forum/confirm-form";
import { CommentsSection } from "@/components/forum/comments";
import { MarkSeen } from "@/components/forum/mark-seen";
import { Cover, StatusLabel, StatusMark } from "@/components/library/book-grid";
import { BookForm } from "@/components/library/book-form";
import { getBook, listBookComments } from "@/lib/library/queries";
import { requireUser } from "@/lib/session";
import { addBookComment, deleteBook, markBookSeen, removeBookComment, setBookCommentHidden, setLent } from "../actions";

export const metadata: Metadata = { title: "Libro" };

export default async function Page({ params }: PageProps<"/admin/biblioteca/[id]">) {
  const user = await requireUser("admin");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const book = await getBook(id);
  if (!book) notFound();
  const comments = await listBookComments(id, user);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/admin/biblioteca" className="text-sm font-extrabold text-verde underline">← Volver a la biblioteca</Link>

      <header className="flex flex-wrap gap-5 rounded-[22px] border border-borde bg-white p-6">
        <span className="relative block aspect-[2/3] w-36 shrink-0 overflow-hidden rounded-xl bg-fondo">
          <Cover id={book.id} title={book.title} />
          <span className="absolute right-2 top-2">
            <StatusMark lent={book.lent} />
          </span>
        </span>
        <div className="flex min-w-[200px] flex-1 flex-col gap-2">
          <h1 className="break-words text-2xl font-extrabold leading-tight">{book.title}</h1>
          <p className="text-[15px] font-bold text-suave">{book.author}</p>
          <div>
            <StatusLabel lent={book.lent} />
          </div>
          <form action={setLent} className="mt-auto pt-2">
            <input type="hidden" name="id" value={book.id} />
            <input type="hidden" name="lent" value={book.lent ? "0" : "1"} />
            <button
              type="submit"
              className={`min-h-12 rounded-xl px-5 text-sm font-extrabold transition ${
                book.lent ? "bg-verde text-white hover:bg-verde-oscuro" : "bg-[#e07a1f] text-white hover:brightness-95"
              }`}
            >
              {book.lent ? "Marcar como disponible" : "Marcar como prestado"}
            </button>
          </form>
        </div>
      </header>

      <MarkSeen action={markBookSeen} postId={id} pending={comments.some((c) => c.isNew)} />
      <CommentsSection
        postId={id}
        comments={comments}
        viewer="admin"
        commentsOpen
        commentAction={addBookComment}
        moderation={{ setHidden: setBookCommentHidden, remove: removeBookComment }}
        openReplies
        label="este libro"
      />

      <details className="rounded-[22px] border border-borde bg-white p-6">
        <summary className="cursor-pointer text-lg font-extrabold">Editar libro</summary>
        <div className="mt-4">
          <BookForm book={{ id: book.id, title: book.title, author: book.author }} />
        </div>
      </details>

      <section aria-label="Eliminar" className="rounded-[22px] border border-borde bg-white p-6">
        <h2 className="mb-1 text-lg font-extrabold">Eliminar libro</h2>
        <p className="mb-4 text-sm font-semibold text-suave">Se borra el libro, su portada y todos sus comentarios.</p>
        <ConfirmForm action={deleteBook} message="¿Eliminar este libro y sus comentarios? No se puede deshacer.">
          <input type="hidden" name="id" value={book.id} />
          <button type="submit" className="min-h-12 rounded-xl border-[1.5px] border-error bg-white px-5 text-sm font-extrabold text-error hover:bg-[#fbe9e9]">
            Eliminar libro
          </button>
        </ConfirmForm>
      </section>
    </div>
  );
}
