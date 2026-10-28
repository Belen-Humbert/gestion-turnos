// Arma un link wa.me que abre WhatsApp con el mensaje ya escrito.
// Nunca envía nada solo: la administradora toca "Enviar" en su propio WhatsApp.

// Espera un celular argentino con código de área, con o sin 0 / 15 / +54 (ej. 261 555 0123).
export function whatsappNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (digits.startsWith("54")) {
    digits = digits.slice(2);
    if (digits.startsWith("9")) digits = digits.slice(1);
  }
  if (digits.startsWith("0")) digits = digits.slice(1);
  // Con 12 dígitos hay un "15" después del código de área (de 2 a 4 dígitos): se quita.
  if (digits.length === 12) {
    for (const area of [2, 3, 4]) {
      if (digits.slice(area, area + 2) === "15") {
        digits = digits.slice(0, area) + digits.slice(area + 2);
        break;
      }
    }
  }
  if (digits.length !== 10) return null;
  return `549${digits}`;
}

export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  const number = whatsappNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function invitationMessage(patientName: string, url: string): string {
  const first = patientName.trim().split(/\s+/)[0] ?? "";
  return `Hola ${first}, te dejo el link para crear tu contraseña y usar la app de turnos: ${url}`;
}

// Respuesta a un pedido de cambio de turno. Texto neutro, sin datos clínicos.
export function changeReplyMessage(patientName: string): string {
  const first = patientName.trim().split(/\s+/)[0] ?? "";
  return `Hola ${first}, recibí tu mensaje sobre el turno. ¿Coordinamos otro horario?`;
}
