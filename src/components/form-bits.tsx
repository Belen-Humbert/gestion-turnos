"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-[52px] w-full rounded-2xl bg-verde px-6 text-base font-extrabold text-white transition hover:bg-verde-oscuro disabled:opacity-60"
    >
      {pending ? "Un momento…" : children}
    </button>
  );
}

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-extrabold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="h-12 rounded-xl border-[1.5px] border-borde bg-white px-3.5 text-base font-semibold"
      />
      {hint ? <span className="text-[13px] font-semibold text-suave">{hint}</span> : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-[#fbe9e9] px-3.5 py-2.5 text-sm font-bold text-error">
      {message}
    </p>
  );
}
