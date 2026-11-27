import { LinkIcon } from "@/components/icons";
import { formatDate } from "@/lib/dates";
import { linkHost } from "@/lib/forum/files";
import type { CommunityPostView } from "@/lib/community/queries";

export function PostLink({ link }: { link: string }) {
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border-[1.5px] border-verde bg-white px-4 text-sm font-extrabold text-verde-oscuro transition hover:bg-verde-claro"
    >
      <LinkIcon size={18} /> Abrir enlace · {linkHost(link)}
    </a>
  );
}

// Publicación aprobada, como la ven los pacientes.
export function PostCard({ post }: { post: CommunityPostView }) {
  return (
    <article aria-label={post.title} className="flex flex-col gap-3 rounded-[22px] border border-borde bg-white p-6 transition hover:border-verde hover:shadow-md">
      <header className="flex flex-col gap-1">
        <h3 className="break-words text-lg font-extrabold leading-snug">{post.title}</h3>
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-bold text-suave">
          <span>{post.isAdmin ? `${post.author} · Consultorio` : post.author}</span>
          {post.approvedAt ? <span>· {formatDate(post.approvedAt)}</span> : null}
          {post.expiresAt ? <span>· hasta el {formatDate(post.expiresAt)}</span> : null}
        </p>
      </header>
      <p className="whitespace-pre-wrap break-words text-[15px] font-semibold leading-relaxed">{post.description}</p>
      {post.link ? <PostLink link={post.link} /> : null}
    </article>
  );
}
