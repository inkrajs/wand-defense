/* The shell is updated only after its built assets are safely cached. */
const scopeUrl = new URL(self.registration.scope);
const PREFIX = `wand-defense-shell-${encodeURIComponent(scopeUrl.pathname)}-`;
const CACHE = `${PREFIX}v3`;
const MAX_ASSETS = 128;
const shellUrl = scopeUrl.href;

function inScope(url) {
  return url.origin === scopeUrl.origin && url.pathname.startsWith(scopeUrl.pathname);
}
function appMetadata(url) {
  return inScope(url) && ["pwa-assets.json", "manifest.webmanifest", "icons/wizard-rounded.svg", "icons/wizard-rounded-192.png", "icons/wizard-rounded-512.png", "icons/wizard-maskable-512.png"]
    .some(path => url.pathname === new URL(path, shellUrl).pathname);
}
function immutableAsset(url) {
  return inScope(url) && /\/assets\/[^/]+-[A-Za-z0-9_-]+\.(?:js|css|woff2?|png|webp|svg)$/.test(url.pathname);
}
function urlsFromHtml(html) {
  const urls = [];
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
    const url = new URL(match[1], shellUrl);
    if (immutableAsset(url) && /\.(?:js|css)$/.test(url.pathname)) urls.push(url.href);
  }
  return [...new Set(urls)];
}
function urlsFromCss(css, stylesheet) {
  const urls = [];
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    const url = new URL(match[1].trim(), stylesheet);
    if (immutableAsset(url)) urls.push(url.href);
  }
  return urls;
}
async function fetchOk(url) {
  const response = await fetch(url, { cache: "reload" });
  if (!response.ok || response.type === "opaque") throw new Error("PWA asset unavailable");
  return response;
}
async function saveShell(response) {
  const html = await response.clone().text();
  const manifestUrl = new URL("pwa-assets.json", shellUrl).href;
  const manifestResponse = await fetchOk(manifestUrl);
  const resourceManifest = await manifestResponse.clone().json();
  if (!Array.isArray(resourceManifest.assets) || !Array.isArray(resourceManifest.optional)) throw new Error("Invalid PWA resources");
  const resourceUrl = path => {
    if (typeof path !== "string") throw new Error("Invalid PWA resource path");
    const url = new URL(path, shellUrl);
    if (!immutableAsset(url)) throw new Error("PWA resource outside application assets");
    return url.href;
  };
  const optional = new Set(resourceManifest.optional.map(resourceUrl));
  const assets = [...new Set([...urlsFromHtml(html), ...resourceManifest.assets.map(resourceUrl)])];
  if (!assets.some(url => /\.js(?:\?|$)/.test(url))) throw new Error("PWA shell has no entry script");
  const cache = await caches.open(CACHE);
  const protectedUrls = new Set([...assets, manifestUrl]);
  for (const path of ["manifest.webmanifest", "icons/wizard-rounded.svg", "icons/wizard-rounded-192.png", "icons/wizard-rounded-512.png", "icons/wizard-maskable-512.png"]) {
    const url = new URL(path, shellUrl).href;
    protectedUrls.add(url);
    await cache.put(url, await fetchOk(url));
  }
  for (const url of assets) {
    const asset = await cache.match(url) ?? await fetchOk(url);
    if (new URL(url).pathname.endsWith(".css")) {
      const dependencies = urlsFromCss(await asset.clone().text(), url);
      for (const dependency of dependencies) {
        // The large extended font is fetched/cached only if real text needs it.
        if (optional.has(dependency)) continue;
        protectedUrls.add(dependency);
        if (!await cache.match(dependency)) await cache.put(dependency, await fetchOk(dependency));
      }
    }
    await cache.put(url, asset);
  }
  // Replace the offline entry only after its referenced assets are available.
  await cache.put(manifestUrl, manifestResponse);
  await cache.put(shellUrl, response);
  const keys = await cache.keys();
  let excess = Math.max(0, keys.length - MAX_ASSETS);
  for (const request of keys) {
    if (!excess) break;
    if (request.url !== shellUrl && !protectedUrls.has(request.url)) {
      await cache.delete(request);
      excess--;
    }
  }
}
self.addEventListener("install", event => {
  event.waitUntil((async () => saveShell(await fetchOk(shellUrl)))());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!inScope(url)) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) event.waitUntil(saveShell(response.clone()).catch(() => {}));
        return response;
      } catch {
        return await (await caches.open(CACHE)).match(shellUrl) ?? Response.error();
      }
    })());
  } else if (appMetadata(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok && response.type !== "opaque") event.waitUntil(cache.put(request, response.clone()));
        return response;
      } catch { return await cache.match(request) ?? Response.error(); }
    })());
  } else if (immutableAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type !== "opaque") event.waitUntil(cache.put(request, response.clone()));
      return response;
    })());
  }
});
