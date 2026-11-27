"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarIcon, ClockIcon } from "@/components/icons";

const triggerCls =
  "flex h-12 w-full items-center justify-between gap-2 rounded-xl border-[1.5px] border-borde bg-white px-3.5 text-left text-base font-semibold transition hover:border-verde hover:bg-verde-claro focus-visible:border-verde";
// El input nativo queda en la página (oculto a la vista) para que el formulario y las pruebas sigan usándolo.
const nativeCls = "sr-only";

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

// ---- Fecha ---------------------------------------------------------------------------------
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayLocal = () => {
  const n = new Date();
  return ymd(n.getFullYear(), n.getMonth(), n.getDate());
};

export function DateField({ id, name, value, onChange }: { id: string; name: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const base = valid ? value : todayLocal();
  const [view, setView] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
  const first = new Date(view.y, view.m, 1);
  const offset = (first.getDay() + 6) % 7; // semana desde el lunes
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => i - offset + 1);
  const today = todayLocal();
  const shift = (n: number) => {
    const d = new Date(view.y, view.m + n, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };
  const label = valid ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : "Elegí una fecha";

  return (
    <div ref={ref} className="relative">
      <input id={id} name={name} type="date" required value={value} onChange={(e) => onChange(e.target.value)} tabIndex={-1} aria-hidden="true" className={nativeCls} />
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Fecha: ${label}`}
        onClick={() => {
          if (!open) setView({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
          setOpen((o) => !o);
        }}
        className={triggerCls}
      >
        <span>{label}</span>
        <CalendarIcon size={20} />
      </button>
      {open ? (
        <div role="dialog" aria-label="Elegir fecha" className="absolute left-0 z-30 mt-2 w-[300px] rounded-2xl border border-borde bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} aria-label="Mes anterior" className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-extrabold transition hover:bg-verde-claro">
              ←
            </button>
            <p className="text-[15px] font-extrabold first-letter:uppercase">
              {MONTHS[view.m]} de {view.y}
            </p>
            <button type="button" onClick={() => shift(1)} aria-label="Mes siguiente" className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-extrabold transition hover:bg-verde-claro">
              →
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="py-1 text-xs font-extrabold text-suave">
                {w}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d < 1 || d > days) return <span key={i} />;
              const v = ymd(view.y, view.m, d);
              const selected = v === value;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onChange(v);
                    setOpen(false);
                  }}
                  aria-label={v}
                  aria-pressed={selected}
                  className={`h-10 rounded-xl text-sm font-bold transition duration-100 hover:scale-110 hover:bg-verde hover:text-white ${
                    selected ? "bg-verde text-white" : v === today ? "bg-verde-claro text-verde-oscuro ring-1 ring-verde" : ""
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              className="min-h-10 rounded-xl px-3 text-sm font-extrabold text-verde-oscuro transition hover:bg-verde-claro"
            >
              Hoy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---- Hora ----------------------------------------------------------------------------------
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));

export function TimeField({ id, name, value, onChange, label }: { id: string; name: string; value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const [h, m] = /^\d{2}:\d{2}$/.test(value) ? value.split(":") : ["", ""];
  const set = (nh: string, nm: string) => onChange(`${nh || "00"}:${nm || "00"}`);
  const item = (selected: boolean) =>
    `flex h-10 w-full items-center justify-center rounded-lg text-sm font-bold transition duration-100 hover:bg-verde hover:text-white ${
      selected ? "bg-verde text-white" : ""
    }`;
  const hourRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && hourRef.current && h) hourRef.current.scrollTop = Math.max(0, Number(h) - 2) * 40;
  }, [open, h]);

  return (
    <div ref={ref} className="relative">
      <input id={id} name={name} type="time" step={300} required value={value} onChange={(e) => onChange(e.target.value)} tabIndex={-1} aria-hidden="true" className={nativeCls} />
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value || "sin elegir"}`}
        onClick={() => setOpen((o) => !o)}
        className={triggerCls}
      >
        <span>{value || "--:--"}</span>
        <ClockIcon size={20} />
      </button>
      {open ? (
        <div role="dialog" aria-label="Elegir hora" className="absolute left-0 z-30 mt-2 flex w-[190px] gap-2 rounded-2xl border border-borde bg-white p-2 shadow-xl">
          <div ref={hourRef} className="max-h-60 flex-1 overflow-y-auto" role="listbox" aria-label="Hora">
            {HOURS.map((x) => (
              <button key={x} type="button" role="option" aria-selected={x === h} onClick={() => set(x, m)} className={item(x === h)}>
                {x}
              </button>
            ))}
          </div>
          <div className="max-h-60 flex-1 overflow-y-auto" role="listbox" aria-label="Minutos">
            {MINUTES.map((x) => (
              <button
                key={x}
                type="button"
                role="option"
                aria-selected={x === m}
                onClick={() => {
                  set(h, x);
                  setOpen(false);
                }}
                className={item(x === m)}
              >
                {x}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---- Duración ------------------------------------------------------------------------------
export function DurationField({ id, name, value, options, onChange }: { id: string; name: string; value: string; options: number[]; onChange: (v: string) => void }) {
  return (
    <div>
      <select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} tabIndex={-1} aria-hidden="true" className={nativeCls}>
        {options.map((d) => (
          <option key={d} value={d}>
            {d} min
          </option>
        ))}
      </select>
      <div role="group" aria-label="Duración" className="flex flex-wrap gap-2">
        {options.map((d) => {
          const on = String(d) === value;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(String(d))}
              className={`min-h-12 rounded-xl border-[1.5px] px-3.5 text-sm font-extrabold transition duration-100 hover:-translate-y-0.5 hover:border-verde hover:bg-verde hover:text-white ${
                on ? "border-verde bg-verde text-white" : "border-borde bg-white text-[#44524d]"
              }`}
            >
              {d} min
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Lista desplegable propia (Repetición) -------------------------------------------------
export function SelectField({
  id,
  name,
  value,
  options,
  onChange,
  label,
}: {
  id: string;
  name: string;
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const current = options.find((o) => o.v === value) ?? options[0];
  return (
    <div ref={ref} className="relative">
      <select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} tabIndex={-1} aria-hidden="true" className={nativeCls}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        className={`${triggerCls} pr-4`}
      >
        <span>{current.label}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <ul role="listbox" aria-label={label} className="absolute left-0 right-0 z-30 mt-2 flex flex-col gap-1 rounded-2xl border border-borde bg-white p-1.5 shadow-xl">
          {options.map((o) => {
            const on = o.v === value;
            return (
              <li key={o.v} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.v);
                    setOpen(false);
                  }}
                  className={`flex min-h-11 w-full items-center rounded-lg px-3 text-left text-[15px] font-bold transition-all duration-150 ${
                    on ? "bg-verde text-white" : "hover:translate-x-1 hover:bg-verde-claro hover:text-verde-oscuro"
                  }`}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
