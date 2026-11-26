"use client";

import { useEffect, useRef } from "react";

// Abre la grilla de 24 h ya posicionada en el horario habitual (no en la madrugada).
export function ScrollToHour({ px }: { px: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = ref.current?.closest<HTMLElement>("[data-agenda-scroll]");
    if (box) box.scrollTop = px;
  }, [px]);
  return <span ref={ref} hidden />;
}
