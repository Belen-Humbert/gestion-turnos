import { AppShell } from "@/components/app-shell";
import { CalendarIcon, ChatIcon, PeopleIcon } from "@/components/icons";
import { requireUser } from "@/lib/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser("admin");
  return (
    <AppShell
      userName={user.name}
      roleLabel="Administradora"
      panelLabel="Panel de administración"
      nav={[
        { href: "/admin", label: "Agenda", icon: <CalendarIcon /> },
        { href: "/admin/pacientes", label: "Pacientes", icon: <PeopleIcon /> },
        { href: "/admin/foro", label: "Foro", icon: <ChatIcon /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
