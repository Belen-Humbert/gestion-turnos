import type { Metadata } from "next";
import Link from "next/link";
import { upcomingTurnos } from "@/lib/patient-turnos";
import { requireUser } from "@/lib/session";
import { toTurnoView } from "./view";
import { TurnoCard } from "./turno-card";

export const metadata: Metadata = { title: "Inicio" };

export default async function PatientHome() {
  const user = await requireUser("patient");
  const [next] = await upcomingTurnos(user.id, 1);
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
    </div>
  );
}
