"use client";

import { useRef, useState } from "react";
import { discardCover, prepareCoverUpload } from "@/app/admin/biblioteca/actions";
import { BookIcon } from "@/components/icons";

// Las fotos del celular pesan varios MB: se reducen en el navegador antes de subirlas.
async function downscale(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const MAX = 1000;
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "portada"}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

type Status = { kind: "idle" } | { kind: "uploading" } | { kind: "ready" } | { kind: "error"; message: string };

// Elegir la foto de la portada: se sube directo al almacenamiento y el formulario guarda solo su clave.
export function CoverUpload({ currentSrc, name = "coverKey" }: { currentSrc?: string; name?: string }) {
  const [key, setKey] = useState("");
  const [preview, setPreview] = useState<string | null>(currentSrc ?? null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);

  async function onPick(files: FileList | null) {
    const original = files?.[0];
    if (!original) return;
    setStatus({ kind: "uploading" });
    try {
      const file = await downscale(original);
      const prepared = await prepareCoverUpload({ name: file.name, size: file.size });
      if (!prepared.ok) {
        setStatus({ kind: "error", message: prepared.error });
        return;
      }
      const res = await fetch(prepared.target.url, { method: prepared.target.method, headers: prepared.target.headers, body: file });
      if (!res.ok) throw new Error("upload");
      if (key) void discardCover(key);
      setKey(prepared.key);
      setPreview(URL.createObjectURL(file));
      setStatus({ kind: "ready" });
    } catch {
      setStatus({ kind: "error", message: "No se pudo subir la foto. Probá de nuevo." });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-extrabold">Foto de la portada</span>
      <input type="hidden" name={name} value={key} />
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex aspect-[2/3] w-28 items-center justify-center overflow-hidden rounded-xl border-[1.5px] border-dashed border-borde bg-fondo text-suave">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vista previa de la portada" className="h-full w-full object-cover" />
          ) : (
            <BookIcon size={34} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            id="coverFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void onPick(e.target.files)}
            className="sr-only"
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={status.kind === "uploading"}
            className="min-h-11 rounded-xl border-[1.5px] border-verde bg-white px-4 text-sm font-extrabold text-verde-oscuro transition hover:bg-verde-claro disabled:opacity-60"
          >
            {status.kind === "uploading" ? "Subiendo…" : preview ? "Cambiar foto" : "Elegir foto"}
          </button>
          {status.kind === "ready" ? <p role="status" className="text-sm font-bold text-verde-oscuro">Foto lista.</p> : null}
          {status.kind === "error" ? <p role="alert" className="text-sm font-bold text-error">{status.message}</p> : null}
          <p className="text-[13px] font-semibold text-suave">JPG, PNG o WEBP. Se achica sola para que cargue rápido.</p>
        </div>
      </div>
    </div>
  );
}
