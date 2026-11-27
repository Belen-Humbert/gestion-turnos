import type { Metadata } from "next";
import Link from "next/link";
import { BookForm } from "@/components/library/book-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Agregar libro" };

export default async function Page() {
  await requireUser("admin");
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Link href="/admin/biblioteca" className="text-sm font-extrabold text-verde underline">← Volver a la biblioteca</Link>
      <header>
        <h1 className="text-3xl font-extrabold">Agregar libro</h1>
        <p className="mt-1 text-[15px] font-semibold text-suave">Foto de la portada, título y autor.</p>
      </header>
      <section className="rounded-[22px] border border-borde bg-white p-6">
        <BookForm />
      </section>
    </div>
  );
}
