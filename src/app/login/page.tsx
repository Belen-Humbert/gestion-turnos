import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getSessionUser, homeFor } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  return (
    <AuthCard title="Ingresar" subtitle="Usá el email con el que recibiste la invitación.">
      <LoginForm />
    </AuthCard>
  );
}
