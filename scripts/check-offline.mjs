import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile, access } from "node:fs/promises";
const code = await readFile("dist/sw.js", "utf8"),
  handlers = {},
  stores = new Map();
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const data = stores.get(name);
    return {
      async addAll(files) {
        for (const file of files) {
          await access("dist" + file);
          data.set(file, "cached:" + file);
        }
      },
      async match(file) {
        return data.get(
          typeof file === "string" ? file : new URL(file.url).pathname,
        );
      },
    };
  },
  async keys() {
    return [...stores.keys()];
  },
  async delete(name) {
    return stores.delete(name);
  },
  async match(request) {
    const file =
      typeof request === "string" ? request : new URL(request.url).pathname;
    for (const data of stores.values())
      if (data.has(file)) return data.get(file);
  },
};
let claimed = false,
  skipped = false,
  online = true;
vm.runInNewContext(code, {
  URL,
  caches,
  fetch: async (request) => {
    if (!online) throw Error("offline");
    return "network:" + request.url;
  },
  self: {
    location: { origin: "https://vydex.test" },
    addEventListener: (name, fn) => (handlers[name] = fn),
    skipWaiting: () => {
      skipped = true;
    },
    clients: {
      claim: () => {
        claimed = true;
      },
    },
  },
});
let pending;
handlers.install({ waitUntil: (p) => (pending = p) });
await pending;
assert(skipped);
assert([...stores.values()][0].has("/index.html"));
assert([...stores.values()][0].has("/assets/planets/mars.jpg"));
stores.set("vydex-offline-old", new Map());
stores.set("unrelated-app", new Map());
handlers.activate({ waitUntil: (p) => (pending = p) });
await pending;
assert(claimed);
assert(!stores.has("vydex-offline-old"));
assert(stores.has("unrelated-app"));
online = false;
let response;
handlers.fetch({
  request: { method: "GET", mode: "navigate", url: "https://vydex.test/" },
  respondWith: (p) => (response = p),
});
assert.equal(await response, "cached:/index.html");
handlers.fetch({
  request: {
    method: "GET",
    mode: "cors",
    url: "https://vydex.test/assets/planets/mars.jpg",
  },
  respondWith: (p) => (response = p),
});
assert.equal(await response, "cached:/assets/planets/mars.jpg");
console.log("PASS offline install: every precache asset exists");
console.log("PASS cache upgrade preserves unrelated application caches");
console.log("PASS offline navigation fallback and planet asset reads");
