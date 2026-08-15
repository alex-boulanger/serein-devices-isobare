import * as esbuild from "esbuild";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8")) as {
  entry: string;
};
const production = process.argv.includes("--production");

await esbuild.build({
  entryPoints: ["src/extension.ts"],
  outfile: manifest.entry,
  bundle: true,
  format: "cjs",
  platform: "node",
  sourcesContent: false,
  logLevel: "info",
  minify: production,
  sourcemap: !production,
  loader: { ".html": "text" },
});
