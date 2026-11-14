import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

const root = "dist";
async function walk(dir) {
  const results = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) results.push(...(await walk(path)));
    else if (item.name !== "sw.js" && !item.name.endsWith(".map"))
      results.push(path);
  }
  return results;
}
const files = (await walk(root)).sort(),
  hash = createHash("sha256");
for (const file of files) hash.update(await readFile(file));
const cache = "vydex-offline-" + hash.digest("hex").slice(0, 14),
  urls = files.map((file) => "/" + relative(root, file).replaceAll("\\", "/"));
const source = `const CACHE=${JSON.stringify(cache)};const FILES=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('vydex-offline-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const request=event.request;const url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;if(request.mode==='navigate'){event.respondWith(fetch(request).catch(()=>caches.match('/index.html')));return;}event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));});`;
await writeFile(join(root, "sw.js"), source);
