import type { Metadata } from "next";
import { SearchIcon } from "@/components/icons";
import { BookGrid, EmptyLibrary } from "@/components/library/book-grid";
import { listBooks } from "@/lib/library/queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function Page({ searchParams }: PageProps<"/paciente/biblioteca">) {
  await requireUser("patient");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const books = await listBooks(q);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header>
        <h1 className="text-3xl font-extrabold">Biblioteca</h1>
        <p className="mt-1 text-[15px] font-semibold text-suave">
          Los libros del consultorio. El tilde verde indica que está disponible; el ícono naranja, que está prestado.
        </p>
      </header>
      <form action="/paciente/biblioteca" className="flex gap-2.5">
        <label htmlFor="q" className="sr-only">Buscar por título o autor</label>
        <div className="relative flex-1">
          <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-suave"><SearchIcon size={18} /></span>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar por título o autor" className="h-12 w-full rounded-xl border-[1.5px] border-borde bg-white pl-10 pr-3.5 text-base font-semibold" />
        </div>
        <button className="min-h-12 rounded-xl border-[1.5px] border-borde bg-white px-5 text-sm font-extrabold hover:bg-fondo">Buscar</button>
      </form>
      {books.length === 0 ? <EmptyLibrary filtered={Boolean(q)} admin={false} /> : <BookGrid books={books} base="/paciente/biblioteca" />}
    </div>
  );
}
