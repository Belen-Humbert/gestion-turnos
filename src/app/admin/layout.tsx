import { AppShell } from "@/components/app-shell";
import { BookIcon, CalendarIcon, ChatIcon, CommunityIcon, InboxIcon, PeopleIcon } from "@/components/icons";
import { countPendingPosts } from "@/lib/community/queries";
import { countNewComments } from "@/lib/forum/queries";
import { countNewBookComments } from "@/lib/library/queries";
import { countOpenRequests } from "@/lib/requests";
import { requireUser } from "@/lib/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser("admin");
  const [pending, newComments, newBookComments, pendingPosts] = await Promise.all([countOpenRequests(), countNewComments(), countNewBookComments(), countPendingPosts()]);
  return (
    <AppShell
      userName={user.name}
      roleLabel="Administradora"
      panelLabel="Panel de administración"
      nav={[
        { href: "/admin", label: "Agenda", icon: <CalendarIcon /> },
        { href: "/admin/pedidos", label: "Pedidos", icon: <InboxIcon />, badge: pending },
        { href: "/admin/pacientes", label: "Pacientes", icon: <PeopleIcon /> },
        { href: "/admin/foro", label: "Foro", icon: <ChatIcon />, badge: newComments },
        { href: "/admin/biblioteca", label: "Biblioteca", icon: <BookIcon />, badge: newBookComments },
        { href: "/admin/comunidad", label: "Comunidad", icon: <CommunityIcon />, badge: pendingPosts },
      ]}
    >
      {children}
    </AppShell>
  );
}
