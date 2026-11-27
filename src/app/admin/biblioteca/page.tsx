import type { Metadata } from "next";
import Link from "next/link";
import { SearchIcon } from "@/components/icons";
import { BookGrid, EmptyLibrary } from "@/components/library/book-grid";
import { listBooks } from "@/lib/library/queries";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function Page({ searchParams }: PageProps<"/admin/biblioteca">) {
  await requireUser("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const books = await listBooks(q);
  const available = books.filter((b) => !b.lent).length;
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Biblioteca</h1>
          <p className="mt-1 text-[15px] font-semibold text-suave">
            {books.length} {books.length === 1 ? "libro" : "libros"} · {available} {available === 1 ? "disponible" : "disponibles"}
          </p>
        </div>
        <Link
          href="/admin/biblioteca/nuevo"
          className="flex min-h-11 items-center gap-2 rounded-xl bg-verde px-4 text-sm font-extrabold text-white hover:bg-verde-oscuro"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span> Agregar libro
        </Link>
      </header>
      <form action="/admin/biblioteca" className="flex gap-2.5">
        <label htmlFor="q" className="sr-only">Buscar por título o autor</label>
        <div className="relative flex-1">
          <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-suave"><SearchIcon size={18} /></span>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar por título o autor" className="h-12 w-full rounded-xl border-[1.5px] border-borde bg-white pl-10 pr-3.5 text-base font-semibold" />
        </div>
        <button className="min-h-12 rounded-xl border-[1.5px] border-borde bg-white px-5 text-sm font-extrabold hover:bg-fondo">Buscar</button>
      </form>
      {books.length === 0 ? <EmptyLibrary filtered={Boolean(q)} admin /> : <BookGrid books={books} base="/admin/biblioteca" admin />}
    </div>
  );
}
