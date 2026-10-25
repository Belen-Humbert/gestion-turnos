import type { Metadata } from "next";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Agenda" };

export default async function AdminHome() {
  const user = await requireUser("admin");
  return (
    <>
      <h1 className="text-3xl font-extrabold">Hola, {user.name.split(" ")[0]}</h1>
      <p className="mt-1 text-[15px] font-semibold text-suave">
        La agenda llega en el próximo paso.
      </p>
    </>
  );
}
