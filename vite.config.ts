import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: "src/ui",
  plugins: [
    svelte({
      configFile: fileURLToPath(new URL("./svelte.config.js", import.meta.url)),
    }),
    viteSingleFile(),
  ],
  build: {
    outDir: "../../build/ui",
    emptyOutDir: true,
  },
});
