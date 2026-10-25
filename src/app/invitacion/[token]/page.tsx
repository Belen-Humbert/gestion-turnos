import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { findValidInvitation } from "@/lib/invitations";
import { AcceptForm } from "./accept-form";

export const metadata: Metadata = { title: "Crear contraseña" };

export default async function InvitationPage({ params }: PageProps<"/invitacion/[token]">) {
  const { token } = await params;
  const invitation = await findValidInvitation(token);

  if (!invitation) {
    return (
      <AuthCard
        title="Invitación no válida"
        subtitle="El link venció o ya fue usado. Pedí una invitación nueva."
      >
        <a href="/login" className="text-sm font-extrabold text-verde underline">
          Ir a ingresar
        </a>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Hola, ${invitation.name.split(" ")[0]}`}
      subtitle="Creá tu contraseña para empezar a usar la aplicación."
    >
      <AcceptForm token={token} email={invitation.email} />
    </AuthCard>
  );
}
