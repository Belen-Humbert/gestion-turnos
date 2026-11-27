import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CommentsSection } from "@/components/forum/comments";
import { Cover, StatusLabel, StatusMark } from "@/components/library/book-grid";
import { getBook, listBookComments } from "@/lib/library/queries";
import { getParticipation } from "@/lib/participation";
import { requireUser } from "@/lib/session";
import { addBookComment, deleteOwnBookComment } from "../actions";

export const metadata: Metadata = { title: "Libro" };

export default async function Page({ params }: PageProps<"/paciente/biblioteca/[id]">) {
  const user = await requireUser("patient");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const book = await getBook(id);
  if (!book) notFound();
  const [comments, participation] = await Promise.all([listBookComments(id, user), getParticipation(user.id)]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/paciente/biblioteca" className="text-sm font-extrabold text-verde underline">← Volver a la biblioteca</Link>
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
          <p className="text-sm font-semibold text-suave">
            {book.lent ? "Ahora está prestado. Podés comentarlo igual." : "Está disponible en el consultorio."}
          </p>
        </div>
      </header>
      <CommentsSection
        postId={id}
        comments={comments}
        viewer="patient"
        commentsOpen
        commentAction={addBookComment}
        deleteOwn={deleteOwnBookComment}
        openReplies
        label="este libro"
        needsAlias={!participation.alias}
      />
    </div>
  );
}
