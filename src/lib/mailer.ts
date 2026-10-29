import nodemailer, { type Transporter } from "nodemailer";

export type Mail = { to: string; subject: string; text: string; html: string };
export type SendResult = "sent" | "simulated";

// Funciona con cualquier proveedor SMTP (Resend, Brevo, Gmail, el del hosting…).
// Sin SMTP_HOST configurado no envía nada: solo avisa por consola, útil en desarrollo.
export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

let transport: Transporter | undefined;
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  if (!mailConfigured()) {
    // No se imprime el destinatario: los datos de pacientes no deben quedar en los registros.
    console.log(`[email simulado] ${mail.subject}`);
    return "simulated";
  }
  await getTransport().sendMail({ from: process.env.MAIL_FROM ?? "Turnos <no-reply@localhost>", ...mail });
  return "sent";
}
