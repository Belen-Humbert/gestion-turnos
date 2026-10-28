import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { PasswordForm, PhoneForm, RemindersForm } from "./profile-forms";

export const metadata: Metadata = { title: "Perfil" };

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-[22px] border border-borde bg-white p-6">
      <h2 className="text-lg font-extrabold">{title}</h2>
      {hint ? <p className="mb-4 mt-0.5 text-sm font-semibold text-suave">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  );
}

export default async function Page() {
  const session = await requireUser("patient");
  const [me] = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
      remindEmail: users.remindEmail,
      remindPush: users.remindPush,
      remind24h: users.remind24h,
      remind2h: users.remind2h,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="text-3xl font-extrabold">Perfil</h1>

      <Card title="Mis datos" hint="Si hay un error en tu nombre o email, avisalo al consultorio.">
        <dl className="mb-5 grid gap-3">
          <div>
            <dt className="text-sm font-extrabold text-suave">Nombre</dt>
            <dd className="text-[15px] font-bold">{me.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-extrabold text-suave">Email</dt>
            <dd className="break-all text-[15px] font-bold">{me.email}</dd>
          </div>
        </dl>
        <PhoneForm phone={me.phone ?? ""} />
      </Card>

      <Card title="Recordatorios de turnos" hint="Elegí cómo y cuándo avisarte antes de cada turno.">
        <RemindersForm reminders={me} />
      </Card>

      <Card title="Contraseña" hint="Al cambiarla se cierra la sesión en tus otros dispositivos.">
        <PasswordForm />
      </Card>
    </div>
  );
}
