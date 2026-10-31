"use client";

import { useEffect } from "react";

// Al abrir una publicación, la administradora "ve" sus comentarios: se apaga el aviso del menú.
export function MarkSeen({ action, postId, pending }: { action: (postId: string) => Promise<void>; postId: string; pending: boolean }) {
  useEffect(() => {
    if (pending) void action(postId);
  }, [action, postId, pending]);
  return null;
}
