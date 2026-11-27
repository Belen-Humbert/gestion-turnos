import { AppShell } from "@/components/app-shell";
import { BookIcon, CalendarIcon, ChatIcon, CommunityIcon, HomeIcon, UserIcon } from "@/components/icons";
import { countPatientForumNews } from "@/lib/forum/queries";
import { getParticipation } from "@/lib/participation";
import { countPatientCommunityNews } from "@/lib/community/queries";
import { requireUser } from "@/lib/session";

export default async function PatientLayout({ children }: LayoutProps<"/paciente">) {
  const user = await requireUser("patient");
  const [news, participation, communityNews] = await Promise.all([
    countPatientForumNews(user.id),
    getParticipation(user.id),
    countPatientCommunityNews(user.id),
  ]);
  return (
    <AppShell
      userName={user.name}
      roleLabel="Paciente"
      panelLabel="Mi espacio"
      nav={[
        { href: "/paciente", label: "Inicio", icon: <HomeIcon /> },
        { href: "/paciente/turnos", label: "Turnos", icon: <CalendarIcon /> },
        ...(participation.forum ? [{ href: "/paciente/foro", label: "Foro", icon: <ChatIcon />, badge: news }] : []),
        ...(participation.library ? [{ href: "/paciente/biblioteca", label: "Biblioteca", icon: <BookIcon /> }] : []),
        ...(participation.community ? [{ href: "/paciente/comunidad", label: "Comunidad", icon: <CommunityIcon />, badge: communityNews }] : []),
        { href: "/paciente/perfil", label: "Perfil", icon: <UserIcon /> },
      ]}
    >
      {children}
    </AppShell>
  );
}
