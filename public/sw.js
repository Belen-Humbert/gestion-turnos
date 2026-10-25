// Service worker mínimo. Por ahora solo hace instalable la app.
// No guarda en caché páginas ni datos: la información de los pacientes nunca queda en el dispositivo.
// En el paso de recordatorios se agregan acá los eventos "push" y "notificationclick".
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
