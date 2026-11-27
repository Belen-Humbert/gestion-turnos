import type { Metadata } from "next";
import Link from "next/link";
import { CommunityForm } from "@/components/community/community-form";
import { COMMUNITY_RULES } from "@/lib/community/rules";
import { participationError } from "@/lib/participation";
import { requireUser } from "@/lib/session";
import { submitPost } from "../actions";

export const metadata: Metadata = { title: "Proponer algo" };

export default async function Page() {
  const user = await requireUser("patient");
  const blocked = await participationError(user, "community");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/paciente/comunidad" className="text-sm font-extrabold text-verde-oscuro">← Volver a Comunidad</Link>
      <h1 className="text-3xl font-extrabold">Proponer algo</h1>
      <p className="text-[15px] font-semibold text-suave">Ana la revisa antes de publicarla. Si hace falta cambiar algo, te lo va a avisar acá.</p>
      {blocked ? (
        <div className="flex flex-col gap-3 rounded-[22px] border border-borde bg-amarillo-claro p-6">
          <p className="text-[15px] font-bold">{blocked}</p>
          <Link href="/paciente/perfil?seccion=privacidad" className="inline-flex min-h-11 w-fit items-center rounded-xl bg-verde px-5 text-sm font-extrabold text-white">Ir a Privacidad</Link>
        </div>
      ) : (
        <>
          <ul className="list-disc rounded-xl bg-fondo p-4 pl-9 text-sm font-semibold leading-relaxed">
            {COMMUNITY_RULES.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <div className="rounded-[22px] border border-borde bg-white p-6">
            <CommunityForm action={submitPost} submitLabel="Enviar a Ana" />
          </div>
        </>
      )}
    </div>
  );
}
