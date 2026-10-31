import { describe, expect, it } from "vitest";
import { signToken, verifyToken, type StorageClaims } from "./token";

const SECRET = "una-clave-de-prueba-de-al-menos-32-caracteres";
const claims: StorageClaims = { op: "get", key: "forum/3f2a8c1e-1b2c-4d5e-8f90-1234567890ab.mp3", exp: 2_000_000, ct: "audio/mpeg" };

describe("URLs firmadas", () => {
  it("ida y vuelta", () => {
    expect(verifyToken(signToken(claims, SECRET), SECRET, 1_000_000)).toEqual(claims);
  });
  it("vence", () => {
    expect(verifyToken(signToken(claims, SECRET), SECRET, 2_000_000)).toBeNull();
    expect(verifyToken(signToken(claims, SECRET), SECRET, 2_000_001)).toBeNull();
  });
  it("rechaza otra clave", () => {
    expect(verifyToken(signToken(claims, SECRET), SECRET + "x", 1)).toBeNull();
  });
  it("rechaza si se altera el contenido", () => {
    const [payload, sig] = signToken(claims, SECRET).split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, key: "forum/ffffffff-1b2c-4d5e-8f90-1234567890ab.mp3" })).toString("base64url");
    expect(verifyToken(`${forged}.${sig}`, SECRET, 1)).toBeNull();
    expect(verifyToken(`${payload}.${sig}x`, SECRET, 1)).toBeNull();
    expect(verifyToken(`${payload}.`, SECRET, 1)).toBeNull();
  });
  it("rechaza basura", () => {
    for (const t of ["", "a", "a.b", "a.b.c", "....", "%%%.%%%"]) expect(verifyToken(t, SECRET, 1), t).toBeNull();
  });
  it("no acepta una operación inventada, aunque esté firmada", () => {
    const bad = signToken({ ...claims, op: "delete" as never }, SECRET);
    expect(verifyToken(bad, SECRET, 1)).toBeNull();
  });
});
