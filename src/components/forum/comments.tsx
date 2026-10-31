import { ConfirmForm } from "./confirm-form";
import { CommentForm } from "./comment-form";
import { ReplyBox } from "./reply-box";
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
  heart,
  adminName = "Ana",
}: {
  postId: string;
  comments: CommentView[];
  viewer: "admin" | "patient";
  commentsOpen: boolean;
  commentAction: FormAction;
  moderation?: { setHidden: Action; remove: Action };
  deleteOwn?: Action;
  heart?: Action; // solo la administradora
  adminName?: string;
}) {
  const visible = comments.filter((c) => !c.hidden).length;
  const roots = comments.filter((c) => !c.parentId);
  const replies = new Map<string, CommentView[]>();
  for (const c of comments) if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
  // Ana puede responder en cualquier comentario; cada paciente solo en los suyos (para seguir la charla con Ana).
  const canReply = (root: CommentView) => (viewer === "admin" ? true : root.mine && commentsOpen);

  function renderComment(c: CommentView) {
    return (
      <div
        key={c.id}
        role="group"
        aria-label={`${c.parentId ? "Respuesta" : "Comentario"} de ${c.author}`}
        data-comment={c.id}
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
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {heart && !c.isAdmin ? (
            <form action={heart}>
              <input type="hidden" name="commentId" value={c.id} />
              <input type="hidden" name="heart" value={c.hearted ? "0" : "1"} />
              <button type="submit" aria-pressed={c.hearted} aria-label={c.hearted ? "Quitar me gusta" : "Me gusta"} className={`${small} text-[15px] ${c.hearted ? "text-error" : "text-suave"}`}>
                {c.hearted ? "♥" : "♡"}
              </button>
            </form>
          ) : null}
          {!heart && c.hearted ? (
            <span data-heart className="rounded-full bg-[#fbe9e9] px-2.5 py-0.5 text-xs font-extrabold text-error">♥ Le gustó a {adminName}</span>
          ) : null}
          {moderation ? (
            <>
              <form action={moderation.setHidden}>
                <input type="hidden" name="commentId" value={c.id} />
                <input type="hidden" name="hide" value={c.hidden ? "0" : "1"} />
                <button type="submit" className={small}>{c.hidden ? "Mostrar" : "Ocultar"}</button>
              </form>
              <ConfirmForm action={moderation.remove} message={c.parentId ? "¿Eliminar esta respuesta? No se puede deshacer." : "¿Eliminar este comentario y sus respuestas? No se puede deshacer."}>
                <input type="hidden" name="commentId" value={c.id} />
                <button type="submit" className={`${small} text-error hover:bg-[#fbe9e9]`}>Eliminar</button>
              </ConfirmForm>
            </>
          ) : null}
          {deleteOwn && c.mine ? (
            <ConfirmForm action={deleteOwn} message="¿Borrar tu comentario?">
              <input type="hidden" name="commentId" value={c.id} />
              <button type="submit" className={`${small} text-error hover:bg-[#fbe9e9]`}>Borrar</button>
            </ConfirmForm>
          ) : null}
        </div>
      </div>
    );
  }
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
        <ul className="mb-5 flex flex-col gap-3">
          {roots.map((root) => (
            <li key={root.id} className="flex flex-col gap-2">
              {renderComment(root)}
              {(replies.get(root.id) ?? []).length > 0 || canReply(root) ? (
                <div className="ml-5 flex flex-col gap-2 border-l-2 border-borde pl-3" aria-label={`Respuestas a ${root.author}`}>
                  {(replies.get(root.id) ?? []).map((r) => renderComment(r))}
                  {canReply(root) ? <ReplyBox postId={postId} parentId={root.id} action={commentAction} /> : null}
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
