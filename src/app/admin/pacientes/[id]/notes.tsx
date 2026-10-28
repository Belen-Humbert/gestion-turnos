"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/form-bits";
import { addNote, deleteNote } from "../notes-actions";

export type NoteView = {
  key: string;
  source: "note" | "event";
  noteId?: string;
  eventId?: string;
  body: string;
  dateLabel: string;
};

function Lock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function NotesSection({ patientId, notes }: { patientId: string; notes: NoteView[] }) {
  const [state, action] = useActionState(addNote, undefined);
  return (
    <section aria-label="Notas privadas" className="rounded-[22px] border border-borde bg-white p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Notas privadas</h2>
        <span className="flex items-center gap-1.5 rounded-full bg-violeta px-2.5 py-0.5 text-xs font-extrabold text-[#3e2f7a]">
          <Lock /> Solo vos
        </span>
      </div>

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="patientId" value={patientId} />
        <label htmlFor="body" className="sr-only">Nueva nota</label>
        <textarea
          id="body"
          name="body"
          rows={3}
          maxLength={4000}
          required
          placeholder="Escribí una nota sobre este paciente"
          className="rounded-xl border-[1.5px] border-borde bg-fondo px-3.5 py-2.5 text-[15px] font-semibold"
        />
        <FormError message={state?.error} />
        {state?.ok ? (
          <p role="status" className="rounded-xl bg-verde-claro px-3.5 py-2.5 text-sm font-extrabold text-verde-oscuro">
            {state.ok}
          </p>
        ) : null}
        <div className="sm:self-end">
          <SubmitButton>Guardar nota</SubmitButton>
        </div>
      </form>

      <div className="mt-5 flex flex-col gap-2.5 border-t border-borde pt-4">
        {notes.length === 0 ? (
          <p className="text-sm font-semibold text-suave">Todavía no hay notas.</p>
        ) : (
          notes.map((n) => <NoteCard key={n.key} note={n} />)
        )}
      </div>
    </section>
  );
}

function NoteCard({ note }: { note: NoteView }) {
  const [state, action] = useActionState(deleteNote, undefined);
  return (
    <article className="rounded-xl bg-fondo px-3.5 py-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-suave">
          {note.dateLabel}
          {note.source === "event" ? (
            <>
              {" · "}
              <Link href={`/admin/agenda/${note.eventId}`} className="text-azul-texto underline">
                del calendario
              </Link>
            </>
          ) : null}
        </p>
        {note.source === "note" ? (
          <form
            action={action}
            onSubmit={(e) => {
              if (!window.confirm("¿Borrar esta nota?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="noteId" value={note.noteId} />
            <button type="submit" className="min-h-9 rounded-lg px-2 text-xs font-extrabold text-error hover:bg-[#fbe9e9]">
              Borrar
            </button>
          </form>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-[15px] font-semibold leading-snug">{note.body}</p>
      {state?.error ? <p role="alert" className="mt-1 text-xs font-bold text-error">{state.error}</p> : null}
    </article>
  );
}
