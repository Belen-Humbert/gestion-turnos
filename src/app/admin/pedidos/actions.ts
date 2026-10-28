"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { changeRequests } from "@/db/schema";
import { requireUser } from "@/lib/session";

export async function resolveRequest(formData: FormData) {
  await requireUser("admin");
  const id = z.string().uuid().safeParse(formData.get("requestId"));
  if (!id.success) return;
  await db
    .update(changeRequests)
    .set({ resolvedAt: new Date() })
    .where(and(eq(changeRequests.id, id.data), isNull(changeRequests.resolvedAt)));
  revalidatePath("/admin", "layout");
}
