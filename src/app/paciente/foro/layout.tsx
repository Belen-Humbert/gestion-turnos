import { requireSection } from "@/lib/participation";
import { requireUser } from "@/lib/session";

// Si el paciente desactivó esta sección en su Perfil, vuelve al inicio.
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("patient");
  await requireSection(user, "forum");
  return children;
}
