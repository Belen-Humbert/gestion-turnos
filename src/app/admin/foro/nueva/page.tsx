import type { Metadata } from "next";
import Link from "next/link";
import { maxFileBytes } from "@/lib/forum/files";
import { requireUser } from "@/lib/session";
import { PostForm } from "../post-form";

export const metadata: Metadata = { title: "Nueva publicación" };

export default async function Page() {
  await requireUser("admin");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/admin/foro" className="text-sm font-extrabold text-verde underline">← Volver al foro</Link>
      <h1 className="text-3xl font-extrabold">Nueva publicación</h1>
      <PostForm maxBytes={maxFileBytes()} />
    </div>
  );
}
