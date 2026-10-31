import { AppShell } from "@/components/app-shell";
import { CalendarIcon, ChatIcon, HomeIcon, UserIcon } from "@/components/icons";
import { countPatientForumNews } from "@/lib/forum/queries";
import { requireUser } from "@/lib/session";

export default async function PatientLayout({ children }: LayoutProps<"/paciente">) {
  const user = await requireUser("patient");
  const news = await countPatientForumNews(user.id);
  return (
    <AppShell
      userName={user.name}
      roleLabel="Paciente"
      panelLabel="Mi espacio"
      nav={[
        { href: "/paciente", label: "Inicio", icon: <HomeIcon /> },
        { href: "/paciente/turnos", label: "Turnos", icon: <CalendarIcon /> },
        { href: "/paciente/foro", label: "Foro", icon: <ChatIcon />, badge: news },
        { href: "/paciente/perfil", label: "Perfil", icon: <UserIcon /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
