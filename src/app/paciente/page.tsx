import type { Metadata } from "next";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Inicio" };

export default async function PatientHome() {
  const user = await requireUser("patient");
  return (
    <>
      <h1 className="text-3xl font-extrabold">Hola, {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-[15px] font-semibold text-suave">
        Acá vas a ver tu próximo turno y las novedades del foro.
      </p>
    </>
  );
}
