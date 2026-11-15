import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getSessionUser, homeFor } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const changed = (await searchParams).clave === "nueva";
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  return (
    <AuthCard title="Ingresar" subtitle="Usá el email con el que recibiste la invitación.">
      {changed ? (
        <p role="status" className="mb-4 rounded-xl bg-verde-claro px-3.5 py-2.5 text-sm font-bold text-verde-oscuro">
          Listo, cambiaste tu contraseña. Ingresá con la nueva.
        </p>
      ) : null}
      <LoginForm />
    </AuthCard>
  );
}
