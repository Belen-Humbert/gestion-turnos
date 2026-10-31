"use client";

import { useActionState, useRef, useState } from "react";
import { FormError, SubmitButton } from "@/components/form-bits";
import { ACCEPT_ATTR, formatBytes, validateUpload } from "@/lib/forum/files";
import { discardUpload, prepareUploads, savePost, type PreparedUpload } from "./actions";

type Upload = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "done" | "error";
  progress: number;
  key?: string;
  fileName?: string;
  error?: string;
};
type LinkRow = { id: string; label: string; url: string };
type Existing = { id: string; label: string; kind: "file" | "link"; detail: string };

const inputCls = "h-12 rounded-xl border-[1.5px] border-borde bg-white px-3.5 text-base font-semibold";
const outlineBtn = "min-h-11 rounded-xl border-[1.5px] border-borde px-4 text-sm font-extrabold hover:bg-fondo";

let counter = 0;
const nextId = () => `n${++counter}`;

function putFile(target: Extract<PreparedUpload, { ok: true }>["target"], file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("El servidor rechazó el archivo.")));
    xhr.onerror = () => reject(new Error("Se cortó la conexión."));
    xhr.send(file);
  });
}

export function PostForm({
  maxBytes,
  initial,
}: {
  maxBytes: number;
  initial?: { id: string; title: string; body: string; attachments: Existing[] };
}) {
  const [state, action] = useActionState(savePost, undefined);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = uploads.some((u) => u.status === "uploading");
  const patch = (id: string, change: Partial<Upload>) => setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...change } : u)));

  async function onPick(files: FileList | null) {
    setNotice(null);
    const picked = Array.from(files ?? []);
    if (fileInput.current) fileInput.current.value = "";
    if (picked.length === 0) return;
    if (picked.length > 10) return setNotice("Elegí hasta 10 archivos por vez.");

    const entries = picked.map((file) => ({ file, up: { id: nextId(), name: file.name, size: file.size, status: "uploading", progress: 0 } as Upload }));
    // Validación rápida en el navegador; el servidor vuelve a validar todo.
    const valid = entries.filter((e) => {
      const check = validateUpload({ name: e.file.name, size: e.file.size }, maxBytes);
      if (!check.ok) {
        e.up.status = "error";
        e.up.error = check.error;
      }
      return check.ok;
    });
    setUploads((list) => [...list, ...entries.map((e) => e.up)]);
    if (valid.length === 0) return;

    let prepared: PreparedUpload[];
    try {
      prepared = await prepareUploads(valid.map((e) => ({ name: e.file.name, size: e.file.size })));
    } catch {
      return valid.forEach((e) => patch(e.up.id, { status: "error", error: "No se pudo preparar la subida. Probá de nuevo." }));
    }
    await Promise.all(
      valid.map(async (e, i) => {
        const p = prepared[i];
        if (!p?.ok) return patch(e.up.id, { status: "error", error: p && !p.ok ? p.error : "No se pudo preparar la subida." });
        try {
          await putFile(p.target, e.file, (pct) => patch(e.up.id, { progress: pct }));
          patch(e.up.id, { status: "done", progress: 100, key: p.key, fileName: p.fileName });
        } catch (err) {
          patch(e.up.id, { status: "error", error: `«${e.file.name}»: ${(err as Error).message}` });
        }
      }),
    );
  }

  function dropUpload(u: Upload) {
    setUploads((list) => list.filter((x) => x.id !== u.id));
    if (u.key) void discardUpload(u.key);
  }

  const doneFiles = uploads.filter((u) => u.status === "done").map((u) => ({ key: u.key, fileName: u.fileName, size: u.size }));

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Con archivos subiéndose no se puede publicar (tampoco con la tecla Enter).
        if (busy) e.preventDefault();
      }}
      className="flex flex-col gap-6"
    >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="files" value={JSON.stringify(doneFiles)} />
      <input type="hidden" name="links" value={JSON.stringify(links.map(({ label, url }) => ({ label, url })))} />
      <input type="hidden" name="removeIds" value={JSON.stringify(removed)} />

      <section className="flex flex-col gap-4 rounded-[22px] border border-borde bg-white p-6" aria-label="Contenido">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-extrabold">Título</label>
          <input id="title" name="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Ej.: Ejercicio de respiración" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="body" className="text-sm font-extrabold">Texto <span className="font-semibold text-suave">(opcional)</span></label>
          <textarea id="body" name="body" rows={6} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} className="rounded-xl border-[1.5px] border-borde bg-white px-3.5 py-2.5 text-[15px] font-semibold" />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[22px] border border-borde bg-white p-6" aria-label="Archivos">
        <div>
          <h2 className="text-lg font-extrabold">Archivos</h2>
          <p className="text-sm font-semibold text-suave">
            Audios, imágenes, PDF y documentos, hasta {formatBytes(maxBytes)} cada uno. Para videos usá un enlace.
          </p>
        </div>

        {initial && initial.attachments.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="Material actual">
            {initial.attachments.map((a) => {
              const gone = removed.includes(a.id);
              return (
                <li key={a.id} className={`flex items-center gap-3 rounded-xl bg-fondo px-3.5 py-2.5 ${gone ? "opacity-50" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className={`block break-words text-sm font-extrabold ${gone ? "line-through" : ""}`}>{a.label}</span>
                    <span className="block text-xs font-semibold text-suave">{a.detail}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemoved((r) => (gone ? r.filter((x) => x !== a.id) : [...r, a.id]))}
                    className="min-h-9 rounded-lg px-2.5 text-xs font-extrabold text-error hover:bg-[#fbe9e9]"
                  >
                    {gone ? "Deshacer" : "Quitar"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div>
          <input ref={fileInput} id="file-picker" type="file" multiple accept={ACCEPT_ATTR} onChange={(e) => void onPick(e.target.files)} className="sr-only" />
          <label htmlFor="file-picker" className={`${outlineBtn} inline-flex cursor-pointer items-center`}>
            + Subir archivos
          </label>
        </div>
        {notice ? <p role="alert" className="text-sm font-bold text-error">{notice}</p> : null}

        {uploads.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="Archivos para publicar">
            {uploads.map((u) => (
              <li key={u.id} className="rounded-xl bg-fondo px-3.5 py-2.5" data-status={u.status}>
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 break-words text-sm font-extrabold">{u.fileName ?? u.name}</span>
                  <span className="text-xs font-bold text-suave">{formatBytes(u.size)}</span>
                  <button type="button" onClick={() => dropUpload(u)} className="min-h-9 rounded-lg px-2.5 text-xs font-extrabold text-error hover:bg-[#fbe9e9]">
                    Quitar
                  </button>
                </div>
                {u.status === "uploading" ? (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-borde" role="progressbar" aria-label={`Subiendo ${u.name}`} aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-verde transition-all" style={{ width: `${u.progress}%` }} />
                  </div>
                ) : null}
                {u.status === "done" ? <p className="mt-1 text-xs font-bold text-verde-oscuro">✓ Listo para publicar</p> : null}
                {u.status === "error" ? <p role="alert" className="mt-1 text-xs font-bold text-error">{u.error}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-[22px] border border-borde bg-white p-6" aria-label="Enlaces">
        <div>
          <h2 className="text-lg font-extrabold">Enlaces</h2>
          <p className="text-sm font-semibold text-suave">YouTube, Drive, artículos u otras páginas.</p>
        </div>
        {links.map((l) => (
          <div key={l.id} className="flex flex-col gap-2 rounded-xl bg-fondo p-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor={`url-${l.id}`} className="text-xs font-extrabold">Dirección</label>
              <input id={`url-${l.id}`} value={l.url} onChange={(e) => setLinks((list) => list.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)))} placeholder="https://…" inputMode="url" className={inputCls} />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor={`label-${l.id}`} className="text-xs font-extrabold">Título <span className="font-semibold text-suave">(opcional)</span></label>
              <input id={`label-${l.id}`} value={l.label} maxLength={120} onChange={(e) => setLinks((list) => list.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)))} className={inputCls} />
            </div>
            <button type="button" onClick={() => setLinks((list) => list.filter((x) => x.id !== l.id))} className="min-h-11 rounded-lg px-3 text-sm font-extrabold text-error hover:bg-[#fbe9e9]">
              Quitar
            </button>
          </div>
        ))}
        <div>
          <button type="button" onClick={() => setLinks((list) => [...list, { id: nextId(), label: "", url: "" }])} className={outlineBtn}>
            + Agregar enlace
          </button>
        </div>
      </section>

      <FormError message={state?.error} />
      <div className={busy ? "pointer-events-none opacity-60" : ""} aria-busy={busy}>
        <SubmitButton>{busy ? "Esperá a que terminen de subir…" : initial ? "Guardar cambios" : "Publicar"}</SubmitButton>
      </div>
    </form>
  );
}
