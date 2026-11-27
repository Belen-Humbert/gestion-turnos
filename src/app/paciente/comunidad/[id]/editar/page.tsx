import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CommunityForm } from "@/components/community/community-form";
import { getPost } from "@/lib/community/queries";
import { requireUser } from "@/lib/session";
import { submitPost } from "../../actions";

export const metadata: Metadata = { title: "Editar propuesta" };

export default async function Page({ params }: PageProps<"/paciente/comunidad/[id]/editar">) {
  const user = await requireUser("patient");
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const post = await getPost(id.data);
  if (!post || post.authorId !== user.id || post.status === "approved") notFound();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/paciente/comunidad" className="text-sm font-extrabold text-verde-oscuro">← Volver a Comunidad</Link>
      <h1 className="text-3xl font-extrabold">{post.status === "changes" ? "Corregir y reenviar" : "Editar propuesta"}</h1>
      {post.status === "changes" && post.moderatorNote ? (
        <p className="rounded-xl bg-amarillo-claro p-4 text-[15px] font-semibold">Ana te pidió: {post.moderatorNote}</p>
      ) : null}
      <div className="rounded-[22px] border border-borde bg-white p-6">
        <CommunityForm action={submitPost} post={post} submitLabel="Reenviar a Ana" />
      </div>
    </div>
  );
}
