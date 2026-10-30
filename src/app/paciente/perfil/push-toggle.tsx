"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "./actions";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on" | "error";

function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 4000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

// Activa o desactiva las notificaciones en ESTE dispositivo. Cada dispositivo se activa por separado.
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const set = (s: State) => !cancelled && setState(s);
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        // En iPhone/iPad las notificaciones solo funcionan con la app agregada a la pantalla de inicio.
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
        return set(ios ? "install" : "unsupported");
      }
      if (Notification.permission === "denied") return set("denied");
      const reg = await registration();
      if (!reg) return set("unsupported");
      set((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await registration();
      if (!reg) return setState("unsupported");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
      const res = await savePushSubscription(sub.toJSON());
      if (!res.ok) {
        await sub.unsubscribe();
        return setState("error");
      }
      setState("on");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await registration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("error");
    } finally {
      setBusy(false);
    }
  }

  const text: Record<State, string> = {
    loading: "Revisando este dispositivo…",
    unsupported: "Este navegador no permite notificaciones. Vas a recibir los avisos por email.",
    install: "En iPhone o iPad, primero agregá la app a la pantalla de inicio y abrila desde ahí.",
    denied: "Las notificaciones están bloqueadas en este navegador. Podés habilitarlas desde sus ajustes.",
    off: "Las notificaciones están desactivadas en este dispositivo.",
    on: "✓ Las notificaciones están activadas en este dispositivo.",
    error: "No se pudo completar. Probá de nuevo en un momento.",
  };

  return (
    <div className="ml-10 flex flex-col items-start gap-2 pb-2" aria-live="polite">
      <p className="text-[13px] font-semibold text-suave">{text[state]}</p>
      {state === "off" || state === "error" ? (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="min-h-11 rounded-xl border-[1.5px] border-verde px-4 text-sm font-extrabold text-verde hover:bg-verde-claro disabled:opacity-60"
        >
          {busy ? "Un momento…" : "Activar en este dispositivo"}
        </button>
      ) : null}
      {state === "on" ? (
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="min-h-11 rounded-xl border-[1.5px] border-borde px-4 text-sm font-extrabold hover:bg-fondo disabled:opacity-60"
        >
          {busy ? "Un momento…" : "Desactivar en este dispositivo"}
        </button>
      ) : null}
    </div>
  );
}
