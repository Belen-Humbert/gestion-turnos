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
  const chosen = patients.find((p) => p.id === value);
  // La lista se cierra al elegir: queda el nombre elegido y un botón para cambiarlo.
  const [picking, setPicking] = useState(!chosen);
  const choose = (id: string) => {
    onChange(id);
    setQ("");
    setPicking(false);
  };
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
      {/* El select real (oculto a la vista) lleva el valor al formulario. */}
      <select id="patientId" name="patientId" required value={value} onChange={(e) => choose(e.target.value)} tabIndex={-1} aria-hidden="true" className="sr-only">
        <option value="" disabled>
          Elegí un paciente
        </option>
        {shown.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {chosen && !picking ? (
        <div aria-live="polite" className="flex min-h-12 items-center gap-3 rounded-xl border-[1.5px] border-verde bg-verde-claro px-3">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-verde text-sm font-extrabold text-white">
            {chosen.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-base font-extrabold text-verde-oscuro">{chosen.name}</span>
          <button type="button" onClick={() => setPicking(true)} className="min-h-10 rounded-lg px-3 text-sm font-extrabold text-verde-oscuro underline transition hover:bg-white">
            Cambiar paciente
          </button>
        </div>
      ) : (
        <>
      <input
        id="patientSearch"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o celular"
        autoComplete="off"
        className={inputCls}
      />
      <ul role="listbox" aria-label="Pacientes" className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border-[1.5px] border-borde bg-white p-1.5">
        {shown.map((p) => {
          const on = p.id === value;
          return (
            <li key={p.id} role="option" aria-selected={on}>
              <button
                type="button"
                onClick={() => choose(p.id)}
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
        </>
      )}
    </div>
  );
}
