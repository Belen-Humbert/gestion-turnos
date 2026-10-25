import { CalendarIcon } from "./icons";

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-[22px] border border-borde bg-white p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-verde text-white">
            <CalendarIcon size={24} />
          </span>
          <span className="text-lg font-extrabold leading-tight">Consultorio de Ana</span>
        </div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1 text-[15px] font-semibold text-suave">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
