export type PaymentStatus = "pending" | "cash" | "transfer";

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  cash: "Pagado en efectivo",
  transfer: "Pagado por transferencia",
};

export const PAYMENT_SHORT: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  cash: "Efectivo",
  transfer: "Transferencia",
};

export function isPaymentStatus(v: unknown): v is PaymentStatus {
  return v === "pending" || v === "cash" || v === "transfer";
}

// Un turno «debe» si ya pasó, es una cita y no se pagó.
export function isOverdue(e: { kind: string; endsAt: Date; paymentStatus: PaymentStatus }, now = new Date()): boolean {
  return e.kind === "appointment" && e.paymentStatus === "pending" && e.endsAt.getTime() < now.getTime();
}
