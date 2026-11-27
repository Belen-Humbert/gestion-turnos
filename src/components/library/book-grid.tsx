import Link from "next/link";
import { BookIcon, CheckIcon, ChatIcon, LentIcon } from "@/components/icons";
import type { BookSummary } from "@/lib/library/queries";

// Distintivo sobre la portada: tilde verde = disponible, ícono naranja = prestado.
export function StatusMark({ lent, size = "md" }: { lent: boolean; size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  return (
    <span
      title={lent ? "Prestado" : "Disponible"}
      aria-hidden="true"
      className={`flex ${dim} items-center justify-center rounded-full text-white shadow-md ring-2 ring-white ${lent ? "bg-[#e07a1f]" : "bg-verde"}`}
    >
      {lent ? <LentIcon size={size === "lg" ? 22 : 18} /> : <CheckIcon size={size === "lg" ? 22 : 18} />}
    </span>
  );
}

export function StatusLabel({ lent }: { lent: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
        lent ? "bg-[#fdeedd] text-[#9a4a05]" : "bg-verde-claro text-verde-oscuro"
      }`}
    >
      {lent ? <LentIcon size={13} /> : <CheckIcon size={13} />}
      {lent ? "Prestado" : "Disponible"}
    </span>
  );
}

export function Cover({ id, title, className = "" }: { id: string; title: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/library/covers/${id}`} alt={`Portada de ${title}`} loading="lazy" className={`h-full w-full object-cover ${className}`} />
  );
}

export function BookGrid({ books, base, admin = false }: { books: BookSummary[]; base: string; admin?: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {books.map((b) => (
        <li key={b.id}>
          <Link
            href={`${base}/${b.id}`}
            className="group flex h-full flex-col overflow-hidden rounded-[18px] border border-borde bg-white transition duration-150 hover:-translate-y-1 hover:border-verde hover:shadow-lg"
          >
            <span className="relative block aspect-[2/3] w-full overflow-hidden bg-fondo">
              <Cover id={b.id} title={b.title} className="transition duration-300 group-hover:scale-105" />
              <span className="absolute right-2 top-2">
                <StatusMark lent={b.lent} />
              </span>
              {admin && b.newComments > 0 ? (
                <span className="absolute left-2 top-2 rounded-full bg-error px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                  {b.newComments} {b.newComments === 1 ? "comentario nuevo" : "comentarios nuevos"}
                </span>
              ) : null}
            </span>
            <span className="flex flex-1 flex-col gap-1 p-3">
              <span className="line-clamp-2 text-[15px] font-extrabold leading-snug">{b.title}</span>
              <span className="line-clamp-1 text-[13px] font-semibold text-suave">{b.author}</span>
              <span className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                <StatusLabel lent={b.lent} />
                <span className="flex items-center gap-1 text-xs font-bold text-suave">
                  <ChatIcon size={14} /> {b.commentCount}
                </span>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function EmptyLibrary({ filtered, admin }: { filtered: boolean; admin: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[18px] border border-borde bg-white p-10 text-center">
      <span aria-hidden="true" className="text-verde">
        <BookIcon size={34} />
      </span>
      <p className="text-base font-bold">{filtered ? "No hay libros con esa búsqueda." : "Todavía no hay libros en la biblioteca."}</p>
      {!filtered && admin ? <p className="text-sm font-semibold text-suave">Agregá el primero con su portada, título y autor.</p> : null}
    </div>
  );
}
