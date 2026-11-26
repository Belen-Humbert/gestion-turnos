import { describe, expect, it } from "vitest";
import { isOverdue, isPaymentStatus } from "./payments";

const now = new Date("2026-11-26T15:00:00Z");
const past = new Date("2026-11-20T15:00:00Z");
const future = new Date("2026-12-01T15:00:00Z");

describe("pagos por turno", () => {
  it("solo un turno pasado y sin pagar figura como pendiente", () => {
    expect(isOverdue({ kind: "appointment", endsAt: past, paymentStatus: "pending" }, now)).toBe(true);
    expect(isOverdue({ kind: "appointment", endsAt: past, paymentStatus: "cash" }, now)).toBe(false);
    expect(isOverdue({ kind: "appointment", endsAt: past, paymentStatus: "transfer" }, now)).toBe(false);
    expect(isOverdue({ kind: "appointment", endsAt: future, paymentStatus: "pending" }, now)).toBe(false);
    expect(isOverdue({ kind: "other", endsAt: past, paymentStatus: "pending" }, now)).toBe(false);
  });
  it("valida el estado", () => {
    expect(isPaymentStatus("cash")).toBe(true);
    expect(isPaymentStatus("paid")).toBe(false);
    expect(isPaymentStatus(null)).toBe(false);
  });
});
