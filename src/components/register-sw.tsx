"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    // También en desarrollo: las notificaciones push lo necesitan. El service worker no guarda datos en caché.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
