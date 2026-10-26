import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { NewPatientForm } from "./new-patient-form";

export const metadata: Metadata = { title: "Agregar paciente" };

export default async function NewPatientPage() {
  await requireUser("admin");
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Link href="/admin/pacientes" className="text-sm font-extrabold text-verde underline">
        ← Volver a pacientes
      </Link>
      <header>
        <h1 className="text-3xl font-extrabold">Agregar paciente</h1>
        <p className="mt-1 text-[15px] font-semibold text-suave">
          Al guardar se genera un link para que cree su contraseña. Nadie puede registrarse por su cuenta.
        </p>
      </header>
      <NewPatientForm />
    </div>
  );
}
