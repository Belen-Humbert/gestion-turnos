import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatBytes, linkHost, maxFileBytes } from "@/lib/forum/files";
import { getPost, listAttachments } from "@/lib/forum/queries";
import { requireUser } from "@/lib/session";
import { PostForm } from "../../post-form";

export const metadata: Metadata = { title: "Editar publicación" };

export default async function Page({ params }: PageProps<"/admin/foro/[id]/editar">) {
  await requireUser("admin");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const post = await getPost(id);
  if (!post) notFound();
  const attachments = await listAttachments(id);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href={`/admin/foro/${id}`} className="text-sm font-extrabold text-verde underline">← Volver a la publicación</Link>
      <h1 className="text-3xl font-extrabold">Editar publicación</h1>
      <PostForm
        maxBytes={maxFileBytes()}
        initial={{
          id,
          title: post.title,
          body: post.body,
          attachments: attachments.map((a) => ({
            id: a.id,
            label: a.label,
            kind: a.kind,
            detail: a.kind === "link" && a.url ? `Enlace · ${linkHost(a.url)}` : `Archivo${a.sizeBytes ? ` · ${formatBytes(a.sizeBytes)}` : ""}`,
          })),
        }}
      />
    </div>
  );
}
