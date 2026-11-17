import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { findValidReset } from "@/lib/password-reset";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function Page({ params }: PageProps<"/recuperar/[token]">) {
  const { token } = await params;
  const reset = await findValidReset(token);
  if (!reset) {
    return (
      <AuthCard title="Link no válido" subtitle="El link venció o ya fue usado. Pedí uno nuevo.">
        <Link href="/recuperar" className="text-sm font-extrabold text-verde underline">Pedir un link nuevo</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title={`Hola, ${reset.name.split(" ")[0]}`} subtitle="Elegí tu contraseña nueva.">
      <ResetForm token={token} email={reset.email} />
    </AuthCard>
  );
}
