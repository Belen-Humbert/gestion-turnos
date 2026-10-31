import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { listPosts } from "@/lib/forum/queries";
import { upcomingTurnos } from "@/lib/patient-turnos";
import { requireUser } from "@/lib/session";
import { toTurnoView } from "./view";
import { TurnoCard } from "./turno-card";

export const metadata: Metadata = { title: "Inicio" };

export default async function PatientHome() {
  const user = await requireUser("patient");
  const [[next], posts] = await Promise.all([upcomingTurnos(user.id, 1), listPosts()]);
  const latest = posts.slice(0, 3);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <header>
        <h1 className="text-3xl font-extrabold">Hola, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-[15px] font-semibold text-suave">Acá ves tu próximo turno y las novedades del foro.</p>
      </header>
      {next ? (
        <>
          <TurnoCard turno={toTurnoView(next)} highlight />
          <Link href="/paciente/turnos" className="text-sm font-extrabold text-verde underline">
            Ver todos mis turnos
          </Link>
        </>
      ) : (
        <p className="rounded-[22px] border border-borde bg-white p-6 text-[15px] font-semibold text-suave">
          Todavía no tenés un turno cargado. Cuando se agende uno, lo vas a ver acá.
        </p>
      )}
      {latest.length > 0 ? (
        <section aria-label="Novedades del foro" className="rounded-[22px] border border-borde bg-white p-6">
          <h2 className="mb-3 text-lg font-extrabold">Novedades del foro</h2>
          <ul className="flex flex-col gap-2">
            {latest.map((p) => (
              <li key={p.id}>
                <Link href={`/paciente/foro/${p.id}`} className="flex min-h-12 flex-col justify-center rounded-xl bg-fondo px-3.5 py-2 hover:bg-verde-claro">
                  <span className="text-[15px] font-extrabold">{p.title}</span>
                  <span className="text-xs font-bold text-suave">{formatDate(p.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/paciente/foro" className="mt-3 inline-block text-sm font-extrabold text-verde underline">
            Ver todo el foro
          </Link>
        </section>
      ) : null}
    </div>
  );
}
