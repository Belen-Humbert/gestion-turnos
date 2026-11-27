"use client";

import { useActionState } from "react";
import { saveBook } from "@/app/admin/biblioteca/actions";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { CoverUpload } from "./cover-upload";

export function BookForm({ book }: { book?: { id: string; title: string; author: string } }) {
  const [state, action] = useActionState(saveBook, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      {book ? <input type="hidden" name="id" value={book.id} /> : null}
      <Field label="Título" name="title" autoComplete="off" defaultValue={state?.values?.title ?? book?.title} />
      <Field label="Autor" name="author" autoComplete="off" defaultValue={state?.values?.author ?? book?.author} />
      <CoverUpload currentSrc={book ? `/api/library/covers/${book.id}` : undefined} />
      <FormError message={state?.error} />
      {state?.ok ? (
        <p role="status" className="rounded-xl bg-verde-claro px-3.5 py-2.5 text-sm font-extrabold text-verde-oscuro">
          {state.ok}
        </p>
      ) : null}
      <SubmitButton>{book ? "Guardar cambios" : "Guardar libro"}</SubmitButton>
    </form>
  );
}
