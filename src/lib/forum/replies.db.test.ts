import "dotenv/config";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { db, pool } from "@/db";
import { forumComments, forumPosts, users } from "@/db/schema";
vi.mock("server-only", () => ({}));
import { createComment } from "./comments";
import { listComments } from "./queries";

// Prueba de integración (necesita DATABASE_URL): reglas de respuestas entre Ana y los pacientes.
async function cleanup() {
  await db.delete(forumPosts).where(like(forumPosts.title, "reply-test%"));
  await db.delete(users).where(like(users.email, "reply-test-%"));
}

describe.skipIf(!process.env.DATABASE_URL)("respuestas a comentarios (con base de datos)", () => {
  let postId: string, otherPost: string;
  let ana: { id: string; role: "admin" }, lu: { id: string; role: "patient" }, ma: { id: string; role: "patient" };
  beforeEach(async () => {
    await cleanup();
    const mk = async (role: "admin" | "patient", name: string, k: string) =>
      (await db.insert(users).values({ role, name, email: `reply-test-${k}@example.com`, passwordHash: "x" }).returning())[0];
    const a = await mk("admin", "Ana Ruiz", "ana"), l = await mk("patient", "Lucía Fernández", "lu"), m = await mk("patient", "Martín Giménez", "ma");
    ana = { id: a.id, role: "admin" }; lu = { id: l.id, role: "patient" }; ma = { id: m.id, role: "patient" };
    postId = (await db.insert(forumPosts).values({ title: "reply-test 1", body: "" }).returning())[0].id;
    otherPost = (await db.insert(forumPosts).values({ title: "reply-test 2", body: "" }).returning())[0].id;
  });
  afterAll(async () => {
    await cleanup();
    await pool.end();
  });
  const root = async () => {
    await createComment(lu, postId, "hola");
    return (await db.select().from(forumComments).where(eq(forumComments.userId, lu.id)))[0];
  };

  it("Ana responde un comentario y la respuesta cuelga de él", async () => {
    const r = await root();
    expect(await createComment(ana, postId, "gracias", r.id)).toEqual({ ok: true });
    const [rep] = await db.select().from(forumComments).where(eq(forumComments.userId, ana.id));
    expect(rep.parentId).toBe(r.id);
  });

  it("responder una respuesta cuelga del comentario original (un solo nivel)", async () => {
    const r = await root();
    await createComment(ana, postId, "uno", r.id);
    const [first] = await db.select().from(forumComments).where(eq(forumComments.userId, ana.id));
    await createComment(lu, postId, "dos", first.id);
    const [second] = await db.select().from(forumComments).where(eq(forumComments.body, "dos"));
    expect(second.parentId).toBe(r.id);
  });

  it("un paciente no puede responder en el hilo de otro paciente", async () => {
    const r = await root();
    expect(await createComment(ma, postId, "me sumo", r.id)).toEqual({ error: "Solo podés responder en tus propios comentarios." });
  });

  it("no se puede responder un comentario de otra publicación ni inexistente", async () => {
    const r = await root();
    expect("error" in (await createComment(ana, otherPost, "x", r.id))).toBe(true);
    expect("error" in (await createComment(ana, postId, "x", "00000000-0000-4000-8000-000000000000"))).toBe(true);
    expect("error" in (await createComment(ana, postId, "x", "no-es-uuid"))).toBe(true);
  });

  it("un paciente no puede responder a un comentario oculto", async () => {
    const r = await root();
    await db.update(forumComments).set({ hiddenAt: new Date() }).where(eq(forumComments.id, r.id));
    expect("error" in (await createComment(lu, postId, "x", r.id))).toBe(true);
  });

  it("al ocultar el comentario, los pacientes tampoco ven sus respuestas; Ana sí", async () => {
    const r = await root();
    await createComment(ana, postId, "resp", r.id);
    await db.update(forumComments).set({ hiddenAt: new Date() }).where(eq(forumComments.id, r.id));
    expect(await listComments(postId, { id: lu.id, role: "patient" })).toHaveLength(0);
    expect(await listComments(postId, { id: ana.id, role: "admin" })).toHaveLength(2);
  });

  it("al eliminar el comentario se eliminan sus respuestas", async () => {
    const r = await root();
    await createComment(ana, postId, "resp", r.id);
    await db.delete(forumComments).where(eq(forumComments.id, r.id));
    expect(await db.$count(forumComments, eq(forumComments.postId, postId))).toBe(0);
  });

  it("el corazón de Ana se ve en el listado", async () => {
    const r = await root();
    await db.update(forumComments).set({ adminHeartedAt: new Date() }).where(eq(forumComments.id, r.id));
    const [c] = await listComments(postId, { id: ma.id, role: "patient" });
    expect(c.hearted).toBe(true);
  });
});
