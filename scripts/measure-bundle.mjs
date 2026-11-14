import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";
const root = resolve("dist");
async function walk(dir) {
  const result = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) result.push(...(await walk(p)));
    else if (!e.name.endsWith(".map")) result.push(p);
  }
  return result;
}
try {
  const files = [];
  for (const path of await walk(root)) {
    const bytes = await readFile(path);
    files.push({
      file: relative(root, path),
      rawBytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      brotliBytes: brotliCompressSync(bytes).length,
    });
  }
  const sum = (key) => files.reduce((s, f) => s + f[key], 0);
  console.log(
    JSON.stringify(
      {
        scope:
          "Entire production dist, all lazy chunks included; excludes source maps. Compression measured locally, not a network trace.",
        files,
        totals: {
          rawBytes: sum("rawBytes"),
          gzipBytes: sum("gzipBytes"),
          brotliBytes: sum("brotliBytes"),
        },
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error("Build dist first with npm run build.", e.message);
  process.exitCode = 1;
}
