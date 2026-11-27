"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/form-bits";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/community/rules";

type State = { error?: string; values?: { title: string; description: string; link: string } } | undefined;

// Formulario de una publicación: título, descripción y enlace. Lo usan los pacientes (van a revisión) y Ana.
export function CommunityForm({
  action,
  post,
  submitLabel,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  post?: { id?: string; title: string; description: string; link: string | null };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const v = state?.values;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {post?.id ? <input type="hidden" name="id" value={post.id} /> : null}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-extrabold">Título</label>
        <input
          id="title"
          name="title"
          required
          maxLength={TITLE_MAX}
          autoComplete="off"
          defaultValue={v?.title ?? post?.title ?? ""}
          placeholder="Ej.: Feria de emprendedores de Lavalle"
          className="h-12 rounded-xl border-[1.5px] border-borde bg-white px-3.5 text-base font-semibold"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-extrabold">Descripción</label>
        <textarea
          id="description"
          name="description"
          required
          rows={5}
          maxLength={DESCRIPTION_MAX}
          defaultValue={v?.description ?? post?.description ?? ""}
          placeholder="Contá de qué se trata: qué es, cuándo, dónde…"
          className="rounded-xl border-[1.5px] border-borde bg-white px-3.5 py-2.5 text-[15px] font-semibold"
        />
        <span className="text-[13px] font-semibold text-suave">Hasta {DESCRIPTION_MAX} caracteres.</span>
      </div>
      <Field
        label="Enlace"
        name="link"
        type="text"
        required={false}
        autoComplete="off"
        defaultValue={v?.link ?? post?.link ?? ""}
        hint="Opcional. La página, red social o lugar donde se puede ver más. Ej.: https://www.ejemplo.com"
      />
      <FormError message={state?.error} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
