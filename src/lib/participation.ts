import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { SessionUser } from "./session";

export type Section = "forum" | "library" | "community";

export type Participation = {
  alias: string | null;
  forum: boolean;
  library: boolean;
  community: boolean;
};

// Qué secciones eligió ver cada paciente y qué nombre de usuario tiene. Ana participa siempre.
export const getParticipation = cache(async (userId: string): Promise<Participation> => {
  const [row] = await db
    .select({ alias: users.alias, forum: users.useForum, library: users.useLibrary, community: users.useCommunity })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? { alias: null, forum: true, library: true, community: true };
});

// Para las pantallas de los pacientes: si desactivó la sección, vuelve al inicio.
export async function requireSection(user: SessionUser, section: Section): Promise<Participation> {
  const p = await getParticipation(user.id);
  if (user.role === "patient" && !p[section]) redirect("/paciente");
  return p;
}

const SECTION_LABEL: Record<Section, string> = { forum: "el Foro", library: "la Biblioteca", community: "la Comunidad" };

// Para publicar o comentar: la sección tiene que estar activada y el paciente tener un nombre de usuario.
// Devuelve el mensaje de error, o null si puede participar. Ana siempre puede.
export async function participationError(user: { id: string; role: "admin" | "patient" }, section: Section): Promise<string | null> {
  if (user.role === "admin") return null;
  const p = await getParticipation(user.id);
  if (!p[section]) return `Activá ${SECTION_LABEL[section]} en tu Perfil para participar.`;
  if (!p.alias) return "Elegí tu nombre de usuario en Perfil → Privacidad para participar.";
  return null;
}
