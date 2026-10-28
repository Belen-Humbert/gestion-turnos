import Link from "next/link";
import { logout } from "@/app/actions";
import { CalendarIcon } from "./icons";

export type NavItem = { href: string; label: string; icon: React.ReactNode; badge?: number };

// Menú lateral en computadora y barra inferior en celular, como en los diseños.
export function AppShell({
  nav,
  userName,
  roleLabel,
  panelLabel,
  children,
}: {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
  panelLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col gap-7 border-r border-borde bg-white px-4 py-7 md:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-verde text-white">
            <CalendarIcon size={22} />
          </span>
          <div>
            <div className="text-base font-extrabold leading-tight">Consultorio de Ana</div>
            <div className="text-xs font-bold text-suave">{panelLabel}</div>
          </div>
        </div>
        <nav aria-label="Secciones" className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-[15px] font-bold text-[#44524d] hover:bg-verde-claro hover:text-verde-oscuro"
            >
              {item.icon}
              {item.label}
              <Badge n={item.badge} />
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-borde px-2 pt-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-verde text-base font-extrabold text-white">
            {userName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-extrabold">{userName}</div>
            <div className="text-xs font-bold text-suave">{roleLabel}</div>
          </div>
        </div>
        <form action={logout}>
          <button className="min-h-11 w-full rounded-xl border-[1.5px] border-borde text-sm font-bold hover:bg-fondo">
            Cerrar sesión
          </button>
        </form>
      </aside>

      <main className="flex-1 px-5 pb-28 pt-6 md:px-10 md:pb-10 md:pt-8">
        <div className="mb-5 flex items-center justify-between md:hidden">
          <span className="text-sm font-bold text-suave">{userName}</span>
          <form action={logout}>
            <button className="min-h-11 rounded-xl border-[1.5px] border-borde px-4 text-sm font-bold">
              Cerrar sesión
            </button>
          </form>
        </div>
        {children}
      </main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 flex justify-around border-t border-borde bg-white px-3 pb-3 pt-2 md:hidden"
      >
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-12 min-w-[72px] flex-col items-center justify-center gap-0.5 text-xs font-bold text-suave"
          >
            <span className="relative">
              {item.icon}
              <Badge n={item.badge} floating />
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Badge({ n, floating = false }: { n?: number; floating?: boolean }) {
  if (!n) return null;
  return (
    <span
      className={`rounded-full bg-error px-1.5 text-[11px] font-extrabold leading-[18px] text-white ${
        floating ? "absolute -right-2.5 -top-1.5" : "ml-auto"
      }`}
      aria-label={`${n} pendientes`}
    >
      {n}
    </span>
  );
}
