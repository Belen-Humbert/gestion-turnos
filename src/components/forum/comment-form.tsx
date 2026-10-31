"use client";

import { useActionState } from "react";
import { FormError, SubmitButton } from "@/components/form-bits";
import { COMMENT_MAX } from "@/lib/forum/limits";

type State = { error?: string; ok?: string; body?: string } | undefined;

export function CommentForm({
  action,
  postId,
  hint,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  postId: string;
  hint?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor={`comment-${postId}`} className="text-sm font-extrabold">
        Tu comentario
      </label>
      <textarea
        id={`comment-${postId}`}
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
      <SubmitButton>Publicar comentario</SubmitButton>
    </form>
  );
}
