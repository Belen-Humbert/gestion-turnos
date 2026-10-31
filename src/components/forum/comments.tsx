import { ConfirmForm } from "./confirm-form";
import { CommentForm } from "./comment-form";
import { formatDateTime } from "@/lib/dates";
import type { CommentView } from "@/lib/forum/queries";

type Action = (formData: FormData) => void | Promise<void>;
type FormAction = (prev: { error?: string; ok?: string; body?: string } | undefined, formData: FormData) => Promise<{ error?: string; ok?: string; body?: string } | undefined>;

const small = "min-h-9 rounded-lg px-2.5 text-xs font-extrabold hover:bg-fondo";

export function CommentsSection({
  postId,
  comments,
  viewer,
  commentsOpen,
  commentAction,
  moderation,
  deleteOwn,
}: {
  postId: string;
  comments: CommentView[];
  viewer: "admin" | "patient";
  commentsOpen: boolean;
  commentAction: FormAction;
  moderation?: { setHidden: Action; remove: Action };
  deleteOwn?: Action;
}) {
  const visible = comments.filter((c) => !c.hidden).length;
  return (
    <section aria-label="Comentarios" className="rounded-[22px] border border-borde bg-white p-6">
      <h2 className="text-lg font-extrabold">Comentarios ({visible})</h2>
      {viewer === "patient" ? (
        <p className="mb-4 mt-0.5 text-sm font-semibold text-suave">Los demás pacientes ven solo tu nombre de pila.</p>
      ) : (
        <p className="mb-4 mt-0.5 text-sm font-semibold text-suave">Vos ves el nombre completo. Los pacientes ven solo el nombre de pila.</p>
      )}

      {comments.length === 0 ? (
        <p className="mb-5 text-sm font-semibold text-suave">Todavía no hay comentarios.</p>
      ) : (
        <ul className="mb-5 flex flex-col gap-2.5">
          {comments.map((c) => (
            <li
              key={c.id}
              aria-label={`Comentario de ${c.author}`}
              className={`rounded-xl px-3.5 py-3 ${c.hidden ? "border-[1.5px] border-dashed border-borde bg-white opacity-70" : "bg-fondo"}`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-extrabold">{c.author}</span>
                {c.isAdmin ? <span className="rounded-full bg-verde-claro px-2 py-0.5 text-[11px] font-extrabold text-verde-oscuro">Administradora</span> : null}
                {c.hidden ? <span className="rounded-full bg-amarillo px-2 py-0.5 text-[11px] font-extrabold text-[#5e3f00]">Oculto para los pacientes</span> : null}
                {c.isNew ? <span className="rounded-full bg-error px-2 py-0.5 text-[11px] font-extrabold text-white">Nuevo</span> : null}
                <span className="text-xs font-bold text-suave">{formatDateTime(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-snug">{c.body}</p>
              {moderation ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <form action={moderation.setHidden}>
                    <input type="hidden" name="commentId" value={c.id} />
                    <input type="hidden" name="hide" value={c.hidden ? "0" : "1"} />
                    <button type="submit" className={small}>{c.hidden ? "Mostrar" : "Ocultar"}</button>
                  </form>
                  <ConfirmForm action={moderation.remove} message="¿Eliminar este comentario? No se puede deshacer.">
                    <input type="hidden" name="commentId" value={c.id} />
                    <button type="submit" className={`${small} text-error hover:bg-[#fbe9e9]`}>Eliminar</button>
                  </ConfirmForm>
                </div>
              ) : null}
              {deleteOwn && c.mine ? (
                <div className="mt-1.5">
                  <ConfirmForm action={deleteOwn} message="¿Borrar tu comentario?">
                    <input type="hidden" name="commentId" value={c.id} />
                    <button type="submit" className={`${small} text-error hover:bg-[#fbe9e9]`}>Borrar</button>
                  </ConfirmForm>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {commentsOpen || viewer === "admin" ? (
        <CommentForm
          action={commentAction}
          postId={postId}
          hint={viewer === "admin" && !commentsOpen ? "Los comentarios de los pacientes están cerrados; vos igual podés responder." : undefined}
        />
      ) : (
        <p className="rounded-xl bg-fondo px-3.5 py-2.5 text-sm font-bold text-suave">Los comentarios de esta publicación están cerrados.</p>
      )}
    </section>
  );
}
