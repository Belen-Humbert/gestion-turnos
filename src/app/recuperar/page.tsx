import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function Page() {
  return (
    <AuthCard title="Recuperar contraseña" subtitle="Escribí tu email y te mandamos un link para elegir una nueva.">
      <RecoverForm />
    </AuthCard>
  );
}
