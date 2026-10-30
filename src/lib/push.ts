import webpush from "web-push";

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string };
export type PushResult = "sent" | "gone" | "simulated";

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@localhost.invalid",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  ready = true;
}

// "gone": el dispositivo ya no existe (404/410) y hay que borrar la suscripción.
export async function sendPush(sub: PushSub, payload: PushPayload): Promise<PushResult> {
  if (!pushConfigured()) {
    console.log(`[push simulado] ${payload.title}: ${payload.body}`);
    return "simulated";
  }
  setup();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      TTL: 60 * 60,
    });
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    throw e;
  }
}
