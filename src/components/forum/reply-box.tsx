"use client";

import { useState } from "react";
import { CommentForm } from "./comment-form";

type FormAction = Parameters<typeof CommentForm>[0]["action"];

// Botón «Responder» que despliega el formulario debajo del comentario y se cierra al publicar.
export function ReplyBox({ postId, parentId, action }: { postId: string; parentId: string; action: FormAction }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      {open ? (
        <div className="rounded-xl bg-white p-3">
          <CommentForm action={action} postId={postId} parentId={parentId} onDone={() => setOpen(false)} />
          <button type="button" onClick={() => setOpen(false)} className="mt-2 min-h-9 rounded-lg px-2.5 text-xs font-extrabold hover:bg-fondo">
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="min-h-9 rounded-lg px-2.5 text-xs font-extrabold hover:bg-white">
          Responder
        </button>
      )}
    </div>
  );
}
