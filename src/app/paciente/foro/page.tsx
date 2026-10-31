import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { listPosts } from "@/lib/forum/queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Foro" };

export default async function Page() {
  await requireUser("patient");
  const posts = await listPosts();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="text-3xl font-extrabold">Foro</h1>
        <p className="mt-1 text-[15px] font-semibold text-suave">Material compartido por el consultorio: audios, lecturas y enlaces.</p>
      </header>
      {posts.length === 0 ? (
        <p className="rounded-[22px] border border-borde bg-white p-6 text-[15px] font-semibold text-suave">Todavía no hay publicaciones.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Publicaciones">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/paciente/foro/${p.id}`} className="block rounded-[22px] border border-borde bg-white p-5 hover:border-verde">
                <h2 className="text-lg font-extrabold">{p.title}</h2>
                {p.body ? <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[15px] font-semibold text-suave">{p.body}</p> : null}
                <p className="mt-2 text-xs font-bold text-suave">
                  {formatDate(p.createdAt)}
                  {p.attachmentCount > 0 ? ` · ${p.attachmentCount} ${p.attachmentCount === 1 ? "adjunto" : "adjuntos"}` : ""} · {p.commentCount}{" "}
                  {p.commentCount === 1 ? "comentario" : "comentarios"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
