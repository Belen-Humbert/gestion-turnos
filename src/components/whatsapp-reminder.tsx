import { whatsappReminderText } from "@/lib/reminder-messages";
import { whatsappLink } from "@/lib/whatsapp";

// Botón manual: abre WhatsApp con el mensaje armado y la administradora decide si lo envía.
// Nunca se envía solo. No se muestra si el paciente no tiene celular; quien lo usa decide si el turno es futuro.
export function WhatsAppReminder({
  phone,
  name,
  startsAt,
  location,
}: {
  phone: string | null;
  name: string;
  startsAt: Date;
  location: string | null;
}) {
  const href = whatsappLink(phone, whatsappReminderText({ name, startsAt, location }));
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center rounded-xl border-[1.5px] border-borde bg-white px-3.5 text-sm font-extrabold text-texto hover:bg-fondo"
    >
      Recordar por WhatsApp
    </a>
  );
}
