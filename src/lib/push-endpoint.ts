// El servidor envía las notificaciones a la dirección (endpoint) que registra el navegador del paciente.
// Para que nadie pueda registrar una dirección interna o ajena y usar al servidor para hacer pedidos,
// solo se aceptan los servicios de push reales de cada navegador (siempre por HTTPS, sin puerto ni credenciales).
const ALLOWED_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge y otros basados en Chromium
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.push\.apple\.com$/, // Safari (web.push.apple.com)
  /^[a-z0-9.-]+\.notify\.windows\.com$/, // Windows (WNS)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  return ALLOWED_HOSTS.some((re) => re.test(url.hostname));
}
