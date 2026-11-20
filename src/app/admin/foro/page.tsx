import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { TypeBadges, TypeIcon } from "@/components/forum/type-icons";
import { FORUM_FILTERS, parseFilters } from "@/lib/forum/filters";
import { formatBytes } from "@/lib/forum/files";
import { forumStorageUsage, listPosts } from "@/lib/forum/queries";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Foro" };

const LABELS = Object.fromEntries(
  FORUM_FILTERS.map((f) => [f.key, f.label]),
) as Record<(typeof FORUM_FILTERS)[number]["key"], string>;

export default async function Page({ searchParams }: PageProps<"/admin/foro">) {
  await requireUser("admin");
  const sp = await searchParams;
  const filters = parseFilters(sp.tipo);
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 80) ?? "";
  const filtering = filters.length > 0 || q !== "";
  const [posts, usage, total] = await Promise.all([
    listPosts(filters, q),
    forumStorageUsage(),
    filtering ? listPosts() : null,
  ]);
  const totalCount = (total ?? posts).length;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Foro</h1>
          <p className="mt-1 text-[15px] font-semibold text-suave">
            Material para los pacientes: audios, lecturas, imágenes y enlaces.
            Ellos pueden comentar.
          </p>
        </div>
        <Link
          href="/admin/foro/nueva"
          className="flex min-h-12 items-center rounded-2xl bg-verde px-5 text-base font-extrabold text-white hover:bg-verde-oscuro"
        >
          Nueva publicación
        </Link>
      </header>

      {totalCount > 0 ? (
        <form
          method="get"
          role="search"
          aria-label="Buscar y filtrar publicaciones"
          className="flex flex-col gap-3 rounded-[22px] border border-borde bg-white p-4"
        >
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">
                Buscar por título, texto o nombre de archivo
              </span>
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-suave">
                <SearchIcon size={20} />
              </span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Buscar por título, texto o nombre de archivo"
                className="min-h-12 w-full rounded-xl border-[1.5px] border-borde bg-white pl-11 pr-3 text-[15px] font-semibold"
              />
            </label>
            <button className="min-h-12 rounded-xl bg-verde px-5 text-sm font-extrabold text-white hover:bg-verde-oscuro">
              Buscar
            </button>
          </div>
          <fieldset className="flex flex-wrap items-center gap-2">
            <legend className="sr-only">Que tenga…</legend>
            <span className="text-sm font-extrabold text-suave" aria-hidden>
              Que tenga:
            </span>
            {FORUM_FILTERS.map((f) => (
              <label key={f.key} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="tipo"
                  value={f.key}
                  defaultChecked={filters.includes(f.key)}
                  className="peer sr-only"
                />
                <span className="flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-borde bg-white px-4 text-sm font-extrabold hover:border-verde peer-checked:border-verde peer-checked:bg-verde peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                  <TypeIcon type={f.key} size={18} />
                  {f.label}
                </span>
              </label>
            ))}
            {filtering ? (
              <Link
                href="/admin/foro"
                className="ml-auto text-sm font-extrabold text-suave underline"
              >
                Limpiar
              </Link>
            ) : null}
          </fieldset>
          {filters.length > 1 ? (
            <p className="text-xs font-bold text-suave">
              Se muestran las publicaciones que tienen todos los tipos marcados.
            </p>
          ) : null}
        </form>
      ) : null}

      {posts.length === 0 ? (
        <p className="rounded-[22px] border border-borde bg-white p-6 text-[15px] font-semibold text-suave">
          {filtering
            ? "No hay publicaciones que coincidan con la búsqueda."
            : "Todavía no hay publicaciones. Creá la primera con «Nueva publicación»."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Publicaciones">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/foro/${p.id}`}
                className="block rounded-[22px] border border-borde bg-white p-5 hover:border-verde"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-extrabold">{p.title}</h2>
                  {p.newComments > 0 ? (
                    <span className="rounded-full bg-error px-2 py-0.5 text-xs font-extrabold text-white">
                      {p.newComments}{" "}
                      {p.newComments === 1
                        ? "comentario nuevo"
                        : "comentarios nuevos"}
                    </span>
                  ) : null}
                </div>
                {p.body ? (
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[15px] font-semibold text-suave">
                    {p.body}
                  </p>
                ) : null}
                <div className="mt-2.5">
                  <TypeBadges groups={p.groups} labels={LABELS} />
                </div>
                <p className="mt-2 text-xs font-bold text-suave">
                  {formatDate(p.createdAt)} · {p.attachmentCount}{" "}
                  {p.attachmentCount === 1 ? "adjunto" : "adjuntos"} ·{" "}
                  {p.commentCount}{" "}
                  {p.commentCount === 1 ? "comentario" : "comentarios"}
                  {p.commentsOpen ? "" : " · comentarios cerrados"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs font-bold text-suave">
        Espacio usado por los archivos: {formatBytes(usage.bytes)} (
        {usage.files} {usage.files === 1 ? "archivo" : "archivos"}).
      </p>
    </div>
  );
}
