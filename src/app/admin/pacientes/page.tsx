import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { listPatients, type PatientFilter } from "@/lib/patients";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Pacientes" };

const FILTERS: { value: PatientFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "activos", label: "Activos" },
  { value: "invitados", label: "Invitación pendiente" },
  { value: "inactivos", label: "Inactivos" },
];

function parseFilter(v: string | string[] | undefined): PatientFilter {
  const value = Array.isArray(v) ? v[0] : v;
  return FILTERS.some((f) => f.value === value) ? (value as PatientFilter) : "todos";
}

export default async function PatientsPage({ searchParams }: PageProps<"/admin/pacientes">) {
  await requireUser("admin");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const filter = parseFilter(sp.estado);
  const patients = await listPatients({ q, filter });

  const href = (estado: PatientFilter) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (estado !== "todos") params.set("estado", estado);
    const qs = params.toString();
    return qs ? `/admin/pacientes?${qs}` : "/admin/pacientes";
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Pacientes</h1>
          <p className="mt-1 text-[15px] font-semibold text-suave">
            {patients.length} {patients.length === 1 ? "paciente" : "pacientes"}
          </p>
        </div>
        <Link
          href="/admin/pacientes/nuevo"
          className="flex min-h-12 items-center rounded-2xl bg-verde px-5 text-[15px] font-extrabold text-white hover:bg-verde-oscuro"
        >
          Agregar paciente
        </Link>
      </header>

      <form action="/admin/pacientes" className="flex gap-2.5">
        {filter !== "todos" ? <input type="hidden" name="estado" value={filter} /> : null}
        <label htmlFor="q" className="sr-only">
          Buscar por nombre o email
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por nombre o email"
          className="h-12 flex-1 rounded-xl border-[1.5px] border-borde bg-white px-3.5 text-base font-semibold"
        />
        <button className="min-h-12 rounded-xl border-[1.5px] border-borde bg-white px-5 text-sm font-extrabold hover:bg-fondo">
          Buscar
        </button>
      </form>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(f.value)}
            aria-current={filter === f.value ? "true" : undefined}
            className={`flex min-h-11 items-center rounded-full px-4 text-sm font-bold ${
              filter === f.value
                ? "bg-verde text-white"
                : "border border-borde bg-white text-[#44524d] hover:bg-verde-claro"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {patients.length === 0 ? (
        <div className="rounded-[18px] border border-borde bg-white p-8 text-center">
          <p className="text-base font-bold">
            {q || filter !== "todos" ? "No hay pacientes con ese filtro." : "Todavía no cargaste pacientes."}
          </p>
          {!q && filter === "todos" ? (
            <p className="mt-1 text-sm font-semibold text-suave">
              Agregá el primero y le llega una invitación para crear su contraseña.
            </p>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {patients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/pacientes/${p.id}`}
                className="flex min-h-[68px] items-center gap-3.5 rounded-[18px] border border-borde bg-white px-4 py-3 hover:border-verde"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violeta text-lg font-extrabold text-violeta-texto">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-extrabold">{p.name}</span>
                  <span className="block truncate text-[13px] font-semibold text-suave">
                    {p.email}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </span>
                </span>
                <StatusBadge status={p.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
