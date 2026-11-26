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
      <select
        id="patientId"
        name="patientId"
        required
        size={Math.min(Math.max(shown.length, 2), 5)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Pacientes"
        className="rounded-xl border-[1.5px] border-borde bg-white px-2 py-1 text-base font-semibold"
      >
        {shown.map((p) => (
          <option key={p.id} value={p.id} className="min-h-10 rounded-lg px-2 py-2">
            {p.name}
            {p.phone ? ` · ${p.phone}` : ""}
          </option>
        ))}
      </select>
      {shown.length === 0 || (shown.length === 1 && shown[0].id === value && term && !norm(shown[0].name).includes(term)) ? (
        <p className="text-sm font-semibold text-suave">Nadie coincide con esa búsqueda.</p>
      ) : null}
    </div>
  );
}
