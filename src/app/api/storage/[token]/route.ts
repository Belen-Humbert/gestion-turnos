import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { localPath, storageSecret } from "@/lib/storage/local";
import { verifyToken } from "@/lib/storage/token";

// Endpoint del almacenamiento LOCAL: equivale a las URLs prefirmadas de R2/S3. No tiene sesión propia:
// la autorización es la firma, que solo genera el servidor después de comprobar permisos y vence rápido.
// Con otro driver (R2) este endpoint no se usa.
export const dynamic = "force-dynamic";

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function claimsFor(token: string) {
  if (process.env.STORAGE_DRIVER && process.env.STORAGE_DRIVER !== "local") return null;
  return verifyToken(token, storageSecret());
}

export async function PUT(request: Request, ctx: RouteContext<"/api/storage/[token]">) {
  const claims = claimsFor((await ctx.params).token);
  if (!claims || claims.op !== "put" || typeof claims.size !== "number") return json({ error: "Enlace inválido o vencido." }, 403);
  if (request.headers.get("content-type") !== claims.ct) return json({ error: "Tipo de archivo distinto del autorizado." }, 415);
  if (Number(request.headers.get("content-length")) !== claims.size) return json({ error: "El tamaño no coincide con el autorizado." }, 400);
  if (!request.body) return json({ error: "Falta el archivo." }, 400);

  let finalPath: string;
  try {
    finalPath = localPath(claims.key);
  } catch {
    return json({ error: "Archivo inválido." }, 400);
  }
  const partPath = `${finalPath}.${process.pid}.part`;
  await fs.mkdir(path.dirname(finalPath), { recursive: true });

  // Corta si llegan más bytes de los autorizados, aunque el encabezado diga otra cosa.
  let received = 0;
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length;
      if (received > claims.size!) cb(new Error("too-large"));
      else cb(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(request.body as never), limiter, createWriteStream(partPath, { flags: "wx" }));
    if (received !== claims.size) throw new Error("incomplete");
    await fs.rename(partPath, finalPath);
  } catch (e) {
    await fs.rm(partPath, { force: true });
    const reason = (e as Error).message;
    return json({ error: reason === "too-large" ? "El archivo supera lo autorizado." : "La subida no se completó." }, reason === "too-large" ? 413 : 400);
  }
  return json({ ok: true }, 200);
}

export async function GET(request: Request, ctx: RouteContext<"/api/storage/[token]">) {
  const claims = claimsFor((await ctx.params).token);
  if (!claims || claims.op !== "get") return json({ error: "Enlace inválido o vencido." }, 403);

  let file: string;
  try {
    file = localPath(claims.key);
  } catch {
    return json({ error: "Archivo inválido." }, 400);
  }
  let size: number;
  try {
    size = (await fs.stat(file)).size;
  } catch {
    return json({ error: "El archivo no existe." }, 404);
  }

  // Soporta "Range" para que el audio se pueda adelantar y retomar.
  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = request.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (m[1] === "") {
      start = Math.max(size - Number(m[2]), 0);
    } else {
      start = Number(m[1]);
      if (m[2] !== "") end = Math.min(Number(m[2]), size - 1);
    }
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    status = 206;
  }

  const name = (claims.name ?? "archivo").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(claims.name ?? "archivo");
  const headers: Record<string, string> = {
    "Content-Type": claims.ct,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${claims.disp === "inline" ? "inline" : "attachment"}; filename="${name}"; filename*=UTF-8''${encoded}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  // Aísla cualquier archivo que el navegador abra como página; el visor de PDF necesita quedar afuera.
  if (claims.ct !== "application/pdf") headers["Content-Security-Policy"] = "sandbox; default-src 'none'";

  return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, { status, headers });
}
