import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { libraryBooks } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { getStorage } from "@/lib/storage";

// Las portadas también pasan por sesión: se exige ser Ana o un paciente activo y recién entonces se
// redirige a una dirección temporal del almacenamiento.
export const dynamic = "force-dynamic";

const deny = (status: number, error: string) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(_request: Request, ctx: RouteContext<"/api/library/covers/[id]">) {
  const user = await getSessionUser();
  if (!user) return deny(401, "Iniciá sesión para ver esta imagen.");
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) return deny(404, "No encontramos la imagen.");
  const [book] = await db
    .select({ key: libraryBooks.coverKey, contentType: libraryBooks.coverContentType })
    .from(libraryBooks)
    .where(eq(libraryBooks.id, id.data))
    .limit(1);
  if (!book) return deny(404, "No encontramos la imagen.");
  const url = await getStorage().createDownloadUrl({ key: book.key, contentType: book.contentType, fileName: "portada", inline: true });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
}
