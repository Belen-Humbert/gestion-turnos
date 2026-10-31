import { z } from "zod";
import { classifyFile } from "@/lib/forum/files";
import { getFileAttachment } from "@/lib/forum/queries";
import { getSessionUser } from "@/lib/session";
import { getStorage } from "@/lib/storage";

// Cada vista o descarga de un archivo del foro pasa por acá. Se exige sesión (administradora o paciente
// activo) y recién entonces se redirige a una dirección temporal del almacenamiento.
export const dynamic = "force-dynamic";

const deny = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request, ctx: RouteContext<"/api/forum/files/[id]">) {
  const user = await getSessionUser();
  if (!user) return deny(401, "Iniciá sesión para ver este archivo.");
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) return deny(404, "No encontramos el archivo.");
  const file = await getFileAttachment(id.data);
  if (!file?.storageKey || !file.fileName || !file.contentType) return deny(404, "No encontramos el archivo.");

  const wantsDownload = new URL(request.url).searchParams.has("descargar");
  const inlineOk = classifyFile(file.fileName)?.inline ?? false;
  const url = await getStorage().createDownloadUrl({
    key: file.storageKey,
    contentType: file.contentType,
    fileName: file.fileName,
    inline: inlineOk && !wantsDownload,
  });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
}
