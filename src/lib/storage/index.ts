import "server-only";
import { createLocalStorage } from "./local";

// Capa de almacenamiento intercambiable. El resto de la app solo conoce esta interfaz:
// para pasar a Cloudflare R2 (u otro servicio compatible con S3) se agrega un driver y se
// cambia STORAGE_DRIVER, sin tocar el foro.
export type UploadTarget = { url: string; method: "PUT"; headers: Record<string, string> };

export interface StorageDriver {
  // Dirección a la que el navegador sube el archivo directamente (el servidor no lo recibe en un formulario).
  createUploadTarget(input: { key: string; contentType: string; size: number }): Promise<UploadTarget>;
  // Dirección temporal para ver o bajar el archivo. Solo se genera después de comprobar permisos.
  createDownloadUrl(input: { key: string; contentType: string; fileName: string; inline: boolean }): Promise<string>;
  stat(key: string): Promise<{ size: number } | null>;
  remove(keys: string[]): Promise<void>;
}

let driver: StorageDriver | undefined;

export function getStorage(): StorageDriver {
  if (driver) return driver;
  const name = process.env.STORAGE_DRIVER ?? "local";
  if (name === "local") return (driver = createLocalStorage());
  throw new Error(`STORAGE_DRIVER="${name}" no está disponible todavía. Usá "local" (desarrollo) o conectá el servicio elegido.`);
}
