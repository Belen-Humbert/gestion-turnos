import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Las pruebas de e2e/ las corre Playwright (npm run e2e), no vitest.
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
});
