import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AttachmentList } from "@/components/forum/attachments";
import { CommentsSection } from "@/components/forum/comments";
import { formatDate } from "@/lib/dates";
import { getPost, listAttachments, listComments } from "@/lib/forum/queries";
import { requireUser } from "@/lib/session";
import { MarkSeen } from "@/components/forum/mark-seen";
import { addComment, deleteOwnComment, markMineSeen } from "../actions";

export const metadata: Metadata = { title: "Foro" };

export default async function Page({ params }: PageProps<"/paciente/foro/[id]">) {
  const user = await requireUser("patient");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const post = await getPost(id);
  if (!post) notFound();
  const [attachments, comments] = await Promise.all([listAttachments(id), listComments(id, user)]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/paciente/foro" className="text-sm font-extrabold text-verde underline">← Volver al foro</Link>
      <header>
        <h1 className="break-words text-3xl font-extrabold">{post.title}</h1>
        <p className="mt-1 text-sm font-bold text-suave">{formatDate(post.createdAt)}</p>
      </header>
      {post.body ? <p className="whitespace-pre-wrap break-words rounded-[22px] border border-borde bg-white p-6 text-[15px] font-semibold leading-relaxed">{post.body}</p> : null}
      <AttachmentList attachments={attachments} />
      <MarkSeen action={markMineSeen} postId={id} pending={comments.some((c) => c.heartNew || c.replyNew)} />
      <CommentsSection postId={id} comments={comments} viewer="patient" commentsOpen={post.commentsOpen} commentAction={addComment} deleteOwn={deleteOwnComment} />
    </div>
  );
}
