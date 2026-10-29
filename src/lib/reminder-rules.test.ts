import { describe, expect, it } from "vitest";
import { dueKinds } from "./reminder-rules";

const H = 3600_000;
const start = new Date("2026-11-04T12:00:00Z");
const longAgo = new Date("2026-10-01T00:00:00Z");
const at = (msBeforeStart: number) => new Date(start.getTime() - msBeforeStart);

describe("dueKinds", () => {
  it("no envía nada antes de que se abra la ventana de 24 h", () => {
    expect(dueKinds(start, longAgo, at(24 * H + 60_000))).toEqual([]);
  });
  it("envía el de 24 h al abrirse la ventana", () => {
    expect(dueKinds(start, longAgo, at(24 * H))).toEqual(["24h"]);
    expect(dueKinds(start, longAgo, at(22 * H))).toEqual(["24h"]);
  });
  it("descarta el de 24 h pasada la tolerancia", () => {
    expect(dueKinds(start, longAgo, at(21 * H))).toEqual([]);
  });
  it("envía el de 2 h dentro de su ventana", () => {
    expect(dueKinds(start, longAgo, at(2 * H))).toEqual(["2h"]);
    expect(dueKinds(start, longAgo, at(1.5 * H))).toEqual(["2h"]);
  });
  it("descarta el de 2 h pasada la tolerancia y no envía una vez empezado el turno", () => {
    expect(dueKinds(start, longAgo, at(1 * H))).toEqual([]);
    expect(dueKinds(start, longAgo, at(0))).toEqual([]);
    expect(dueKinds(start, longAgo, new Date(start.getTime() + H))).toEqual([]);
  });
  it("no manda el de 24 h si la cita se agendó con menos de 24 h", () => {
    expect(dueKinds(start, at(10 * H), at(10 * H - 1000))).toEqual([]);
  });
  it("sí manda el de 2 h si la cita se agendó con más de 2 h", () => {
    expect(dueKinds(start, at(10 * H), at(2 * H))).toEqual(["2h"]);
  });
  it("no manda el de 2 h si la cita se agendó después de abrirse esa ventana", () => {
    expect(dueKinds(start, at(1.5 * H), at(1.4 * H))).toEqual([]);
  });
});
