import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const scope = 'https://example.test/wand-defense/';
type Handler = (event: any) => void;
function worker(failingAsset: boolean | 'html' = false) {
  const handlers = new Map<string, Handler>();
  const stores = new Map<string, Map<string, Response>>();
  let skipped = 0, claimed = 0, deleted = 0, fetched = 0;
  const key = (request: string | Request) => typeof request === 'string' ? request : request.url;
  const caches = {
    async keys() {return [...stores.keys()];},
    async delete() {deleted++;},
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {match: async (request: string | Request, options?: {ignoreVary?: boolean}) => {
        const response=store.get(key(request));
        // Precache URL requests have no Origin; module requests can include it.
        if (response?.headers.get('vary') === 'Origin' && typeof request !== 'string'
          && request.headers.has('origin') && !options?.ignoreVary) return undefined;
        return response?.clone();
      },
        put: async (request: string | Request, response: Response) => {store.set(key(request), response.clone());},
        keys: async () => [...store.keys()].map(url => new Request(url)),
        delete: async (request: Request) => store.delete(request.url)};
    },
  };
  runInNewContext(source, {URL, Response, caches,
    self: {registration: {scope}, clients: {claim: async () => {claimed++;}},
      skipWaiting: async () => {skipped++;}, addEventListener: (type: string, handler: Handler) => handlers.set(type, handler)},
    fetch: async (url: string) => {
      fetched++;
      if (url === scope) return new Response('<script type="module" src="assets/app-123abc.js"></script>');
      if (url.endsWith('pwa-assets.json')) return new Response(JSON.stringify({assets: ['assets/app-123abc.js'], optional: []}));
      if (url.endsWith('app-123abc.js') && failingAsset) return failingAsset === 'html'
        ? new Response('<html>SPA fallback</html>',{headers:{'content-type':'text/html'}}) : new Response('', {status: 503});
      return new Response('resource');
    },
  });
  return {handlers, caches, stores, get skipped() {return skipped;}, get claimed() {return claimed;}, get deleted() {return deleted;}, get fetched() {return fetched;}};
}

test('worker never skips waiting on install/activate or capability checks; only a scoped versioned command activates', async () => {
  const w = worker(); const pending: Promise<unknown>[] = [], replies: any[] = [];
  const waitUntil = (promise: Promise<unknown>) => pending.push(promise);
  w.handlers.get('install')!({waitUntil}); await Promise.all(pending);
  assert.equal(w.skipped, 0);
  w.handlers.get('activate')!({waitUntil}); await Promise.all(pending);
  assert.equal(w.claimed, 1); assert.equal(w.deleted, 0); assert.equal(w.skipped, 0);
  const send = (type: string, url = scope, protocol = 1) => w.handlers.get('message')!({data: {type, protocol}, source: {url}, ports: [{postMessage: (reply: unknown) => replies.push(reply)}], waitUntil});
  send('PWA_UPDATE_CAPABILITIES'); assert.equal(replies[0].canSkipWaiting, true); assert.equal(w.skipped, 0);
  send('SKIP_WAITING', 'https://elsewhere.test/'); send('SKIP_WAITING', scope, 0); send('unrecognized');
  assert.equal(w.skipped, 0);
  send('SKIP_WAITING'); await Promise.all(pending);
  assert.equal(w.skipped, 1); assert.equal(replies.at(-1).type, 'PWA_UPDATE_ACCEPTED');
});

test('failed precaching never publishes a partial offline entry or deletes the previous shell', async () => {
  const w = worker(true);
  const old = await w.caches.open('wand-defense-shell-%2Fwand-defense%2F-v3');
  await old.put(scope, new Response('previous shell'));
  let installing: Promise<unknown> | undefined;
  w.handlers.get('install')!({waitUntil: (promise: Promise<unknown>) => {installing = promise;}});
  await assert.rejects(installing!);
  assert.equal(await (await old.match(scope))!.text(), 'previous shell');
  for (const [name, entries] of w.stores) if (name.includes('v4-')) assert.equal(entries.has(scope), false);
  assert.equal(w.deleted, 0); assert.equal(w.skipped, 0);
});

test('a prior release lazy asset remains readable after another tab activates the new worker', async () => {
  const w = worker();
  const old = await w.caches.open('wand-defense-shell-%2Fwand-defense%2F-v3');
  const url = `${scope}assets/old-123abc.js`;
  await old.put(url, new Response('previous chunk'));
  let response: Promise<Response> | undefined;
  w.handlers.get('fetch')!({request: new Request(url), respondWith: (promise: Promise<Response>) => {response = promise;}, waitUntil() {}});
  assert.equal(await (await response!).text(), 'previous chunk');
  assert.equal(w.fetched, 0); assert.equal(w.deleted, 0);
});


test('immutable precached chunks ignore Origin-only Vary differences on module requests', async () => {
  const w=worker(), cache=await w.caches.open('wand-defense-shell-%2Fwand-defense%2F-v3');
  const url=`${scope}assets/previous-abc123.js`;
  await cache.put(url,new Response('cached module',{headers:{Vary:'Origin','Content-Type':'text/javascript'}}));
  let response:Promise<Response>|undefined;
  w.handlers.get('fetch')!({request:new Request(url,{headers:{Origin:'https://example.test'}}),
    respondWith:(next:Promise<Response>)=>{response=next;},waitUntil(){}});
  assert.equal(await(await response!).text(),'cached module');
  assert.equal(w.fetched,0);
});

test('an HTML SPA fallback for a missing chunk cannot publish an offline shell', async () => {
  const w=worker('html');let installing:Promise<unknown>|undefined;
  w.handlers.get('install')!({waitUntil:(next:Promise<unknown>)=>{installing=next;}});
  await assert.rejects(installing!);
  for(const entries of w.stores.values()) assert.equal(entries.has(scope),false);
});
