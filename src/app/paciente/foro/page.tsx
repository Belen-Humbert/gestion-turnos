import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { FORUM_FILTERS, parseFilter } from "@/lib/forum/filters";
import { listPosts } from "@/lib/forum/queries";
import { TypeBadges, TypeIcon } from "@/components/forum/type-icons";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Foro" };

const LABELS = Object.fromEntries(
  FORUM_FILTERS.map((f) => [f.key, f.label]),
) as Record<(typeof FORUM_FILTERS)[number]["key"], string>;
const chip =
  "flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-extrabold";

export default async function Page({
  searchParams,
}: PageProps<"/paciente/foro">) {
  await requireUser("patient");
  const filter = parseFilter((await searchParams).tipo);
  const [posts, all] = await Promise.all([
    listPosts(filter ? [filter] : []),
    filter ? listPosts() : null,
  ]);
  const total = (all ?? posts).length;
  const label = FORUM_FILTERS.find(
    (f) => f.key === filter,
  )?.label.toLowerCase();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="text-3xl font-extrabold">Foro</h1>
        <p className="mt-1 text-[15px] font-semibold text-suave">
          Material compartido por el consultorio: audios, lecturas y enlaces.
        </p>
      </header>
      {total > 0 ? (
        <nav aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
          <Link
            href="/paciente/foro"
            aria-current={filter ? undefined : "page"}
            className={`${chip} ${filter ? "border-borde bg-white" : "border-verde bg-verde text-white"}`}
          >
            Todo
          </Link>
          {FORUM_FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/paciente/foro?tipo=${f.key}`}
              aria-current={filter === f.key ? "page" : undefined}
              className={`${chip} ${filter === f.key ? "border-verde bg-verde text-white" : "border-borde bg-white hover:border-verde"}`}
            >
              <TypeIcon type={f.key} size={18} />
              {f.label}
            </Link>
          ))}
        </nav>
      ) : null}
      {posts.length === 0 ? (
        <p className="rounded-[22px] border border-borde bg-white p-6 text-[15px] font-semibold text-suave">
          {filter
            ? `No hay publicaciones con ${label} por ahora.`
            : "Todavía no hay publicaciones."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Publicaciones">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/paciente/foro/${p.id}`}
                className="block rounded-[22px] border border-borde bg-white p-5 hover:border-verde"
              >
                <h2 className="text-lg font-extrabold">{p.title}</h2>
                {p.body ? (
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[15px] font-semibold text-suave">
                    {p.body}
                  </p>
                ) : null}
                {p.groups.length > 0 ? (
                  <div className="mt-2.5">
                    <TypeBadges groups={p.groups} labels={LABELS} />
                  </div>
                ) : null}
                <p className="mt-2 text-xs font-bold text-suave">
                  {formatDate(p.createdAt)}
                  {p.attachmentCount > 0
                    ? ` · ${p.attachmentCount} ${p.attachmentCount === 1 ? "adjunto" : "adjuntos"}`
                    : ""}{" "}
                  · {p.commentCount}{" "}
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
