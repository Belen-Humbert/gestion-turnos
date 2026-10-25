import type { Metadata } from "next";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Turnos" };

export default async function Page() {
  await requireUser("patient");
  return (
    <>
      <h1 className="text-3xl font-extrabold">Turnos</h1>
      <p className="mt-1 text-[15px] font-semibold text-suave">Esta sección llega en un próximo paso.</p>
    </>
  );
}
