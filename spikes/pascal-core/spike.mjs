import { build } from "esbuild";
import { stat } from "node:fs/promises";
await build({ entryPoints: ["entry.mjs"], outfile: "dist/bundle.js", bundle: true, minify: true, platform: "browser", format: "esm", external: ["react", "three", "@react-three/*"] });
const bytes = (await stat("dist/bundle.js")).size;
console.log(JSON.stringify({ exportUnderTest: "useScene", bundleBytes: bytes, peersExternalized: true }, null, 2));
