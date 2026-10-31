import type { Metadata } from "next";
import Link from "next/link";
import { formatBytes } from "@/lib/forum/files";
import { forumStorageUsage, listPosts } from "@/lib/forum/queries";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Foro" };

export default async function Page() {
  await requireUser("admin");
  const [posts, usage] = await Promise.all([listPosts(), forumStorageUsage()]);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Foro</h1>
          <p className="mt-1 text-[15px] font-semibold text-suave">
            Material para los pacientes: audios, lecturas, imágenes y enlaces. Ellos pueden comentar.
          </p>
        </div>
        <Link href="/admin/foro/nueva" className="flex min-h-12 items-center rounded-2xl bg-verde px-5 text-base font-extrabold text-white hover:bg-verde-oscuro">
          Nueva publicación
        </Link>
      </header>

      {posts.length === 0 ? (
        <p className="rounded-[22px] border border-borde bg-white p-6 text-[15px] font-semibold text-suave">
          Todavía no hay publicaciones. Creá la primera con «Nueva publicación».
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Publicaciones">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/foro/${p.id}`} className="block rounded-[22px] border border-borde bg-white p-5 hover:border-verde">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold">{p.title}</h2>
                  {p.newComments > 0 ? (
                    <span className="rounded-full bg-error px-2 py-0.5 text-xs font-extrabold text-white">
                      {p.newComments} {p.newComments === 1 ? "comentario nuevo" : "comentarios nuevos"}
                    </span>
                  ) : null}
                </div>
                {p.body ? <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[15px] font-semibold text-suave">{p.body}</p> : null}
                <p className="mt-2 text-xs font-bold text-suave">
                  {formatDate(p.createdAt)} · {p.attachmentCount} {p.attachmentCount === 1 ? "adjunto" : "adjuntos"} · {p.commentCount}{" "}
                  {p.commentCount === 1 ? "comentario" : "comentarios"}
                  {p.commentsOpen ? "" : " · comentarios cerrados"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs font-bold text-suave">
        Espacio usado por los archivos: {formatBytes(usage.bytes)} ({usage.files} {usage.files === 1 ? "archivo" : "archivos"}).
      </p>
    </div>
  );
}
