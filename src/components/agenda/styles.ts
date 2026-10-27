import type { AgendaEvent } from "@/lib/agenda";

// Colores como en los diseños: verde = confirmada, amarillo = sin confirmar, azul = otro evento.
export function eventTone(e: Pick<AgendaEvent, "kind" | "confirmedAt">) {
  if (e.kind === "other") return { box: "bg-azul text-azul-texto border-azul-texto", label: "Otro evento" };
  if (e.confirmedAt) return { box: "bg-verde-claro text-verde-oscuro border-verde", label: "Confirmada" };
  return { box: "bg-amarillo text-[#5e3f00] border-[#c58a00]", label: "Sin confirmar" };
}
