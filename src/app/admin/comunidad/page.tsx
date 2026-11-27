import type { Metadata } from "next";
import Link from "next/link";
import { ReviewActions } from "@/components/community/admin-actions";
import { PostLink } from "@/components/community/post-card";
import { adminCounts, listPostsForAdmin, type AdminTab } from "@/lib/community/queries";
import { formatDate } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Comunidad" };

const TABS: { id: AdminTab; label: string; key: "pendientes" | "cambios" | "publicadas" | "vencidas"; empty: string }[] = [
  { id: "pendientes", label: "Pendientes", key: "pendientes", empty: "No hay publicaciones esperando revisión." },
  { id: "cambios", label: "Con cambios pedidos", key: "cambios", empty: "No hay publicaciones esperando correcciones." },
  { id: "publicadas", label: "Publicadas", key: "publicadas", empty: "Todavía no hay publicaciones vigentes." },
  { id: "vencidas", label: "Vencidas", key: "vencidas", empty: "No hay publicaciones vencidas." },
];

export default async function Page({ searchParams }: PageProps<"/admin/comunidad">) {
  const user = await requireUser("admin");
  const sp = await searchParams;
  const current = TABS.find((t) => t.id === sp.tab) ?? TABS[0];
  const [posts, counts] = await Promise.all([listPostsForAdmin(current.id, { id: user.id, role: "admin" }), adminCounts()]);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Comunidad</h1>
          <p className="mt-1 text-[15px] font-semibold text-suave">Revisá lo que proponen los pacientes. Lo aprobado se muestra durante un mes.</p>
        </div>
        <Link href="/admin/comunidad/nueva" className="inline-flex min-h-11 items-center rounded-xl bg-verde px-5 text-sm font-extrabold text-white hover:bg-verde-oscuro">
          Nueva publicación
        </Link>
      </header>
      <nav aria-label="Estados" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.id === current.id;
          return (
            <Link
              key={t.id}
              href={`/admin/comunidad?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              className={`min-h-11 rounded-xl border-[1.5px] px-4 py-2.5 text-sm font-extrabold ${active ? "border-verde bg-verde-claro text-verde-oscuro" : "border-borde bg-white hover:border-verde"}`}
            >
              {t.label} ({counts[t.key]})
            </Link>
          );
        })}
      </nav>
      {posts.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-borde bg-white p-8 text-center text-[15px] font-semibold text-suave">{current.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {posts.map((p) => (
            <li key={p.id}>
              <article aria-label={p.title} className="flex flex-col gap-3 rounded-[22px] border border-borde bg-white p-6">
                <header>
                  <h2 className="break-words text-lg font-extrabold">{p.title}</h2>
                  <p className="text-[13px] font-bold text-suave">
                    {p.author} · enviada el {formatDate(p.createdAt)}
                    {p.expiresAt ? ` · ${p.expired ? "venció" : "vence"} el ${formatDate(p.expiresAt)}` : ""}
                  </p>
                </header>
                <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-relaxed">{p.description}</p>
                {p.link ? <PostLink link={p.link} /> : null}
                {p.status === "changes" && p.moderatorNote ? (
                  <p className="rounded-xl bg-amarillo-claro p-3 text-sm font-semibold">Pediste: {p.moderatorNote}</p>
                ) : null}
                <ReviewActions id={p.id} status={p.status} expired={p.expired} />
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
