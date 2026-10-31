import "server-only";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isValidStorageKey } from "@/lib/forum/files";
import type { StorageDriver } from "./index";
import { signToken } from "./token";

// Guarda en una carpeta del disco. Pensado para desarrollo y pruebas: en un hosting con disco
// efímero los archivos se perderían, por eso en producción conviene un servicio de objetos (R2/S3).
const UPLOAD_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_TTL_MS = 2 * 60 * 60 * 1000;

export function storageSecret(): string {
  const secret = process.env.STORAGE_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Falta STORAGE_SECRET (mínimo 32 caracteres) para el almacenamiento local.");
  }
  // Solo desarrollo: una clave derivada de la base, estable entre reinicios.
  return createHash("sha256").update(`dev-storage-${process.env.DATABASE_URL ?? ""}`).digest("hex");
}

export function localRoot(): string {
  return path.resolve(process.env.STORAGE_LOCAL_DIR ?? ".storage");
}

export function localPath(key: string): string {
  if (!isValidStorageKey(key)) throw new Error("Clave de archivo inválida.");
  const full = path.resolve(localRoot(), key);
  if (!full.startsWith(localRoot() + path.sep)) throw new Error("Clave de archivo inválida.");
  return full;
}

export function createLocalStorage(): StorageDriver {
  return {
    async createUploadTarget({ key, contentType, size }) {
      localPath(key);
      const token = signToken({ op: "put", key, ct: contentType, size, exp: Date.now() + UPLOAD_TTL_MS }, storageSecret());
      return { url: `/api/storage/${token}`, method: "PUT", headers: { "Content-Type": contentType } };
    },
    async createDownloadUrl({ key, contentType, fileName, inline }) {
      localPath(key);
      const token = signToken(
        { op: "get", key, ct: contentType, name: fileName, disp: inline ? "inline" : "attachment", exp: Date.now() + DOWNLOAD_TTL_MS },
        storageSecret(),
      );
      return `/api/storage/${token}`;
    },
    async stat(key) {
      try {
        const s = await fs.stat(localPath(key));
        return s.isFile() ? { size: s.size } : null;
      } catch {
        return null;
      }
    },
    async remove(keys) {
      await Promise.all(keys.map((k) => fs.rm(localPath(k), { force: true })));
    },
  };
}
