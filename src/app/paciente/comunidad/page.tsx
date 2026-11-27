import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { PostCard } from "@/components/community/post-card";
import { listActivePosts, listMyPosts, markMyPostsSeen } from "@/lib/community/queries";
import { COMMUNITY_RULES } from "@/lib/community/rules";
import { formatDate } from "@/lib/dates";
import { participationError } from "@/lib/participation";
import { requireUser } from "@/lib/session";
import { deleteMyPost } from "./actions";

export const metadata: Metadata = { title: "Comunidad" };

const STATUS = {
  pending: { label: "En revisión", cls: "bg-amarillo-claro" },
  changes: { label: "Ana pidió cambios", cls: "bg-amarillo-claro" },
  approved: { label: "Publicada", cls: "bg-verde-claro" },
} as const;

export default async function Page({ searchParams }: PageProps<"/paciente/comunidad">) {
  const user = await requireUser("patient");
  const sp = await searchParams;
  const viewer = { id: user.id, role: "patient" as const };
  const [posts, mine, blocked] = await Promise.all([listActivePosts(viewer), listMyPosts(viewer), participationError(user, "community")]);
  // Al abrir la sección se consideran vistas las decisiones de Ana.
  after(() => markMyPostsSeen(user.id));
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Comunidad</h1>
          <p className="mt-1 text-[15px] font-semibold text-suave">Emprendimientos, eventos, películas y recomendaciones compartidas entre pacientes. Ana revisa cada publicación.</p>
        </div>
        <Link href="/paciente/comunidad/nueva" className="inline-flex min-h-11 items-center rounded-xl bg-verde px-5 text-sm font-extrabold text-white hover:bg-verde-oscuro">
          Proponer algo
        </Link>
      </header>
      {sp.enviada ? (
        <p role="status" className="rounded-xl bg-verde-claro p-4 text-[15px] font-bold text-verde-oscuro">
          ¡Listo! Ana va a revisar tu propuesta. Te avisamos acá cuando la responda.
        </p>
      ) : null}
      {blocked ? <p className="rounded-xl bg-amarillo-claro p-4 text-[15px] font-bold">{blocked}</p> : null}

      {mine.length > 0 ? (
        <section aria-labelledby="mis" className="flex flex-col gap-3">
          <h2 id="mis" className="text-xl font-extrabold">Mis propuestas</h2>
          <ul className="flex flex-col gap-3">
            {mine.map((p) => {
              const st = STATUS[p.status];
              return (
                <li key={p.id} className="flex flex-col gap-2 rounded-[22px] border border-borde bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="break-words text-base font-extrabold">{p.title}</h3>
                    <span className={`rounded-full px-3 py-1 text-[13px] font-extrabold ${st.cls}`}>
                      {p.status === "approved" && p.expired ? "Vencida" : st.label}
                    </span>
                  </div>
                  {p.status === "changes" && p.moderatorNote ? (
                    <p className="rounded-xl bg-amarillo-claro p-3 text-sm font-semibold">Ana te pidió: {p.moderatorNote}</p>
                  ) : null}
                  {p.expiresAt ? <p className="text-[13px] font-bold text-suave">{p.expired ? "Venció" : "Se muestra hasta"} el {formatDate(p.expiresAt)}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {p.status !== "approved" ? (
                      <Link href={`/paciente/comunidad/${p.id}/editar`} className="inline-flex min-h-11 items-center rounded-xl border-[1.5px] border-verde bg-white px-4 text-sm font-extrabold text-verde-oscuro hover:bg-verde-claro">
                        {p.status === "changes" ? "Corregir y reenviar" : "Editar"}
                      </Link>
                    ) : null}
                    <form action={deleteMyPost}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="min-h-11 rounded-xl border-[1.5px] border-borde bg-white px-4 text-sm font-extrabold hover:bg-fondo">
                        {p.status === "approved" ? "Quitar" : "Retirar"}
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="vigentes" className="flex flex-col gap-3">
        <h2 id="vigentes" className="text-xl font-extrabold">Publicaciones</h2>
        {posts.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-borde bg-white p-8 text-center text-[15px] font-semibold text-suave">
            Todavía no hay publicaciones. ¡Podés ser la primera persona en proponer algo!
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {posts.map((p) => (
              <li key={p.id}><PostCard post={p} /></li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-labelledby="normas" className="rounded-[22px] border border-borde bg-white p-6">
        <h2 id="normas" className="text-lg font-extrabold">Normas de la comunidad</h2>
        <ul className="mt-2 list-disc pl-5 text-[15px] font-semibold leading-relaxed">
          {COMMUNITY_RULES.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </aside>
    </div>
  );
}
