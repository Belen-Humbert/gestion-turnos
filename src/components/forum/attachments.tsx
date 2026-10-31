import { AudioIcon, FileIcon, ImageIcon, LinkIcon } from "@/components/icons";
import { formatBytes, linkHost } from "@/lib/forum/files";
import type { AttachmentView } from "@/lib/forum/queries";

const card = "flex flex-col gap-2.5 rounded-2xl border border-borde bg-white p-4";
const btn = "inline-flex min-h-11 items-center rounded-xl border-[1.5px] border-borde px-4 text-sm font-extrabold hover:bg-fondo";

// Los archivos nunca llevan una dirección pública: cada vista o descarga pasa por /api/forum/files,
// que comprueba la sesión y recién entonces genera una dirección temporal.
const fileUrl = (id: string, download = false) => `/api/forum/files/${id}${download ? "?descargar=1" : ""}`;

function Meta({ a }: { a: AttachmentView }) {
  return a.sizeBytes ? <span className="text-[13px] font-semibold text-suave">{formatBytes(a.sizeBytes)}</span> : null;
}

export function AttachmentList({ attachments }: { attachments: AttachmentView[] }) {
  if (attachments.length === 0) return null;
  return (
    <ul aria-label="Material" className="flex flex-col gap-3">
      {attachments.map((a) => {
        const type = a.contentType ?? "";
        if (a.kind === "link" && a.url) {
          return (
            <li key={a.id} className={`${card} sm:flex-row sm:items-center`}>
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <span className="text-verde"><LinkIcon /></span>
                <span className="min-w-0">
                  <span className="block break-words text-[15px] font-extrabold">{a.label}</span>
                  <span className="block truncate text-[13px] font-semibold text-suave">{linkHost(a.url)}</span>
                </span>
              </span>
              <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className={btn}>
                Abrir enlace
              </a>
            </li>
          );
        }
        if (type.startsWith("audio/")) {
          return (
            <li key={a.id} className={card}>
              <span className="flex items-center gap-3">
                <span className="text-verde"><AudioIcon /></span>
                <span className="min-w-0 flex-1 break-words text-[15px] font-extrabold">{a.label}</span>
                <Meta a={a} />
              </span>
              <audio controls preload="none" src={fileUrl(a.id)} className="w-full" aria-label={a.label} />
              <a href={fileUrl(a.id, true)} className="self-start text-sm font-extrabold text-verde underline">
                Descargar audio
              </a>
            </li>
          );
        }
        if (type.startsWith("image/")) {
          return (
            <li key={a.id} className={card}>
              <span className="flex items-center gap-3">
                <span className="text-verde"><ImageIcon /></span>
                <span className="min-w-0 flex-1 break-words text-[15px] font-extrabold">{a.label}</span>
                <Meta a={a} />
              </span>
              <a href={fileUrl(a.id)} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fileUrl(a.id)} alt={a.label} loading="lazy" className="max-h-96 w-auto max-w-full rounded-xl border border-borde" />
              </a>
            </li>
          );
        }
        return (
          <li key={a.id} className={`${card} sm:flex-row sm:items-center`}>
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="text-verde"><FileIcon /></span>
              <span className="min-w-0">
                <span className="block break-words text-[15px] font-extrabold">{a.label}</span>
                <Meta a={a} />
              </span>
            </span>
            <span className="flex flex-wrap gap-2">
              {type === "application/pdf" ? (
                <a href={fileUrl(a.id)} target="_blank" rel="noopener noreferrer" className={btn}>
                  Abrir
                </a>
              ) : null}
              <a href={fileUrl(a.id, true)} className={btn}>
                Descargar
              </a>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
