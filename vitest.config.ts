import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    // Mirror tsconfig's "@/*" -> "./src/*" so tests can resolve app imports.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
