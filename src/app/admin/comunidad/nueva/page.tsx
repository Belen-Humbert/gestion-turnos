import type { Metadata } from "next";
import Link from "next/link";
import { CommunityForm } from "@/components/community/community-form";
import { requireUser } from "@/lib/session";
import { createAdminPost } from "../actions";

export const metadata: Metadata = { title: "Nueva publicación" };

export default async function Page() {
  await requireUser("admin");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/admin/comunidad" className="text-sm font-extrabold text-verde-oscuro">← Volver a Comunidad</Link>
      <h1 className="text-3xl font-extrabold">Nueva publicación</h1>
      <p className="text-[15px] font-semibold text-suave">Tus publicaciones se muestran enseguida y duran un mes.</p>
      <div className="rounded-[22px] border border-borde bg-white p-6">
        <CommunityForm action={createAdminPost} submitLabel="Publicar" />
      </div>
    </div>
  );
}
