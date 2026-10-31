"use client";

import { useActionState, useEffect } from "react";
import { FormError, SubmitButton } from "@/components/form-bits";
import { COMMENT_MAX } from "@/lib/forum/limits";

type State = { error?: string; ok?: string; body?: string } | undefined;

export function CommentForm({
  action,
  postId,
  hint,
  parentId,
  onDone,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  postId: string;
  hint?: string;
  parentId?: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(action, undefined);
  useEffect(() => {
    if (state?.ok && onDone) onDone();
  }, [state, onDone]);
  const fieldId = `comment-${parentId ?? postId}`;
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="postId" value={postId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <label htmlFor={fieldId} className="text-sm font-extrabold">
        {parentId ? "Tu respuesta" : "Tu comentario"}
      </label>
      <textarea
        id={fieldId}
        name="body"
        rows={3}
        required
        maxLength={COMMENT_MAX}
        defaultValue={state?.body ?? ""}
        className="rounded-xl border-[1.5px] border-borde bg-white px-3.5 py-2.5 text-[15px] font-semibold"
      />
      {hint ? <p className="text-[13px] font-semibold text-suave">{hint}</p> : null}
      <FormError message={state?.error} />
      {state?.ok ? (
        <p role="status" className="rounded-xl bg-verde-claro px-3.5 py-2.5 text-sm font-bold text-verde-oscuro">
          {state.ok}
        </p>
      ) : null}
      <SubmitButton>{parentId ? "Responder" : "Publicar comentario"}</SubmitButton>
    </form>
  );
}
