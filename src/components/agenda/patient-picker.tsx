"use client";

import { useState } from "react";

export type PickerPatient = { id: string; name: string; phone?: string | null };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "");

// Elegir paciente con buscador: se filtra por nombre o por celular mientras se escribe.
export function PatientPicker({
  patients,
  value,
  onChange,
  inputCls,
  labelCls,
}: {
  patients: PickerPatient[];
  value: string;
  onChange: (id: string) => void;
  inputCls: string;
  labelCls: string;
}) {
  const [q, setQ] = useState("");
  const term = norm(q.trim());
  const d = digits(q);
  const shown = patients.filter(
    (p) =>
      p.id === value ||
      !term ||
      norm(p.name).includes(term) ||
      (d.length >= 3 && digits(p.phone ?? "").includes(d)),
  );
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="patientSearch" className={labelCls}>Paciente</label>
      <input
        id="patientSearch"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o celular"
        autoComplete="off"
        className={inputCls}
      />
      {/* El select real (oculto a la vista) lleva el valor al formulario. */}
      <select id="patientId" name="patientId" required value={value} onChange={(e) => onChange(e.target.value)} tabIndex={-1} aria-hidden="true" className="sr-only">
        <option value="" disabled>
          Elegí un paciente
        </option>
        {shown.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ul role="listbox" aria-label="Pacientes" className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border-[1.5px] border-borde bg-white p-1.5">
        {shown.map((p) => {
          const on = p.id === value;
          return (
            <li key={p.id} role="option" aria-selected={on}>
              <button
                type="button"
                onClick={() => onChange(p.id)}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-bold transition-all duration-150 ${
                  on ? "bg-verde text-white" : "hover:translate-x-1 hover:bg-verde-claro hover:text-verde-oscuro"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${on ? "bg-white/25" : "bg-violeta text-violeta-texto"}`}
                >
                  {p.name.charAt(0).toUpperCase()}
                </span>
                {p.name}
              </button>
            </li>
          );
        })}
      </ul>
      {shown.filter((p) => p.id !== value || norm(p.name).includes(term) || !term).length === 0 ? (
        <p className="text-sm font-semibold text-suave">Nadie coincide con esa búsqueda.</p>
      ) : null}
    </div>
  );
}
