import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const outdir = "apps/widget/dist";
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await cp("apps/widget/public/index.html", `${outdir}/index.html`);
await cp("apps/widget/public/styles.css", `${outdir}/styles.css`);
await build({
  entryPoints: ["apps/widget/src/main.ts"],
  bundle: true,
  minify: true,
  sourcemap: true,
  platform: "browser",
  format: "esm",
  outfile: `${outdir}/app.js`,
});
