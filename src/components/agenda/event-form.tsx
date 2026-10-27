"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cancelEvent, saveEvent } from "@/app/admin/agenda/actions";
import { FormError, SubmitButton } from "@/components/form-bits";

const inputCls = "h-12 rounded-xl border-[1.5px] border-borde bg-white px-3.5 text-base font-semibold";
const labelCls = "text-sm font-extrabold";

export type EventDefaults = {
  id?: string;
  kind: "appointment" | "other";
  patientId?: string;
  patientName?: string;
  title?: string;
  date: string;
  start: string;
  end?: string;
  duration?: number;
  location?: string;
  note?: string;
};

const DURATIONS = [30, 45, 50, 60, 90];
const REPEATS = [
  { v: "0", label: "No repetir" },
  { v: "4", label: "Todas las semanas, durante 4 semanas" },
  { v: "8", label: "Todas las semanas, durante 8 semanas" },
  { v: "12", label: "Todas las semanas, durante 12 semanas" },
  { v: "26", label: "Todas las semanas, durante 26 semanas" },
];

export function EventForm({
  defaults,
  patients = [],
}: {
  defaults: EventDefaults;
  patients?: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(saveEvent, undefined);
  const editing = Boolean(defaults.id);
  const isAppointment = defaults.kind === "appointment";
  const v = (k: string, fallback: string) => state?.values?.[k] ?? fallback;
  const duration = Number(v("duration", String(defaults.duration ?? 50)));
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-[22px] border border-borde bg-white p-6">
      <input type="hidden" name="kind" value={defaults.kind} />
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      {isAppointment ? (
        editing ? (
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Paciente</span>
            <p className="text-lg font-extrabold">{defaults.patientName}</p>
          </div>
        ) : patients.length === 0 ? (
          <p className="rounded-xl bg-amarillo px-4 py-3 text-sm font-bold text-[#5e3f00]">
            Todavía no hay pacientes activos.{" "}
            <Link href="/admin/pacientes/nuevo" className="underline">
              Agregá uno primero
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="patientId" className={labelCls}>Paciente</label>
            <select
              id="patientId"
              name="patientId"
              required
              defaultValue={v("patientId", defaults.patientId ?? "")}
              className={inputCls}
            >
              <option value="" disabled>Elegí un paciente</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className={labelCls}>Título</label>
          <input id="title" name="title" required maxLength={120} defaultValue={v("title", defaults.title ?? "")} className={inputCls} placeholder="Ej.: Clase" />
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-[200px] flex-[2] flex-col gap-1.5">
          <label htmlFor="date" className={labelCls}>Fecha</label>
          <input id="date" name="date" type="date" required defaultValue={v("date", defaults.date)} className={inputCls} />
        </div>
        <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
          <label htmlFor="start" className={labelCls}>{isAppointment ? "Hora" : "Desde"}</label>
          <input id="start" name="start" type="time" step={300} required defaultValue={v("start", defaults.start)} className={inputCls} />
        </div>
        {isAppointment ? (
          <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
            <label htmlFor="duration" className={labelCls}>Duración</label>
            <select id="duration" name="duration" defaultValue={String(duration)} className={inputCls}>
              {durations.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
            <label htmlFor="end" className={labelCls}>Hasta</label>
            <input id="end" name="end" type="time" step={300} required defaultValue={v("end", defaults.end ?? "")} className={inputCls} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="location" className={labelCls}>
          Lugar o enlace <span className="text-[13px] font-semibold text-suave">(opcional)</span>
        </label>
        <input id="location" name="location" maxLength={200} defaultValue={v("location", defaults.location ?? "")} className={inputCls} placeholder="Ej.: consultorio o enlace de la videollamada" />
      </div>

      {!editing ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="repeat" className={labelCls}>Repetición</label>
          <select id="repeat" name="repeat" defaultValue={v("repeat", "0")} className={inputCls}>
            {REPEATS.map((r) => (
              <option key={r.v} value={r.v}>{r.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className={`${labelCls} flex items-center gap-1.5`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Nota privada <span className="text-[13px] font-semibold text-suave">· solo la ves vos</span>
        </label>
        <textarea id="note" name="note" rows={3} maxLength={2000} defaultValue={v("note", defaults.note ?? "")} className="rounded-xl border-[1.5px] border-borde bg-white px-3.5 py-2.5 text-[15px] font-semibold" />
      </div>

      <FormError message={state?.error} />
      <SubmitButton>{editing ? "Guardar cambios" : isAppointment ? "Guardar cita" : "Guardar evento"}</SubmitButton>
    </form>
  );
}

export function CancelForm({
  id,
  inSeries,
  label,
}: {
  id: string;
  inSeries: boolean;
  label: string;
}) {
  const [state, action] = useActionState(cancelEvent, undefined);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`¿${label}? Se libera el horario.`)) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={id} />
      {inSeries ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-extrabold">Es parte de una repetición semanal</legend>
          <label className="flex min-h-11 items-center gap-2.5 text-[15px] font-bold">
            <input type="radio" name="scope" value="one" defaultChecked className="h-5 w-5 accent-verde" /> Solo este
          </label>
          <label className="flex min-h-11 items-center gap-2.5 text-[15px] font-bold">
            <input type="radio" name="scope" value="following" className="h-5 w-5 accent-verde" /> Este y los siguientes
          </label>
        </fieldset>
      ) : null}
      <FormError message={state?.error} />
      <button
        type="submit"
        className="min-h-12 w-fit rounded-xl border-[1.5px] border-error bg-white px-5 text-sm font-extrabold text-error hover:bg-[#fbe9e9]"
      >
        {label}
      </button>
    </form>
  );
}
