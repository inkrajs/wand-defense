import assert from 'node:assert/strict';
import test from 'node:test';
import { createPwaManager, type PwaEnvironment, type PwaRegistration, type PwaWorker } from './state';

class Worker extends EventTarget implements PwaWorker {
  state: ServiceWorkerState = 'installed';
  postMessage() {}
}
class Registration extends EventTarget implements PwaRegistration {
  waiting: Worker | null = null;
  installing: Worker | null = null;
  active: Worker | null = new Worker();
  checks = 0;
  async update() {this.checks++;}
}
function fixture(overrides: Partial<PwaEnvironment> = {}) {
  const registration = new Registration(), next = new Worker();
  let controller: PwaWorker | null = registration.active;
  let online = true, now = 0, reloads = 0, registrations = 0;
  const controllerListeners = new Set<() => void>();
  const messages: string[] = [];
  const env: PwaEnvironment = {
    production: true, supported: true, online: () => online, installed: () => false,
    controller: () => controller, register: async () => {registrations++; return registration;},
    message: async (_worker, type) => {messages.push(type); return true;},
    onControllerChange(listener) {controllerListeners.add(listener); return () => {controllerListeners.delete(listener);};},
    reload: () => {reloads++;}, now: () => now, timeoutMs: 25, throttleMs: 100,
    ...overrides,
  };
  const manager = createPwaManager(env);
  return {manager, env, registration, next, messages, controllerListeners,
    get reloads() {return reloads;}, get registrations() {return registrations;},
    setOnline(value: boolean) {online = value;}, setNow(value: number) {now = value;},
    changeController(value: PwaWorker | null) {controller = value; controllerListeners.forEach(listener => listener());},
  };
}
const turn = () => new Promise(resolve => setTimeout(resolve, 0));

test('development and unsupported environments do not register or check; automatic checks coalesce and throttle', async () => {
  for (const flags of [{production: false}, {supported: false}]) {
    const f = fixture(flags);
    assert.equal(await f.manager.checkForUpdates(), false);
    assert.equal(await f.manager.applyUpdate(), false);
    assert.equal(f.registrations, 0); assert.equal(f.registration.checks, 0); assert.equal(f.reloads, 0);
    assert.equal(f.manager.getSnapshot().update, 'unavailable');
    f.manager.dispose();
  }
  const f = fixture();
  await Promise.all([f.manager.checkForUpdates(false), f.manager.checkForUpdates(false)]);
  assert.equal(f.registrations, 1); assert.equal(f.registration.checks, 1);
  await f.manager.checkForUpdates(false); assert.equal(f.registration.checks, 1);
  f.setNow(101); await f.manager.checkForUpdates(false); assert.equal(f.registration.checks, 2);
  await f.manager.checkForUpdates(true); assert.equal(f.registration.checks, 3);
  f.manager.dispose();
});

test('first installation is offline-ready, not an update; a background update never reloads any tab', async () => {
  const first = fixture({controller: () => null});
  await first.manager.checkForUpdates();
  assert.equal(first.manager.getSnapshot().update, 'offline-ready');
  assert.equal(await first.manager.applyUpdate(), false);
  assert.equal(first.messages.length, 0); assert.equal(first.reloads, 0);
  const f = fixture();
  await f.manager.checkForUpdates();
  f.registration.installing = f.next;
  f.next.state = 'installing';
  f.registration.dispatchEvent(new Event('updatefound'));
  assert.equal(f.manager.getSnapshot().update, 'downloading');
  f.registration.installing = null; f.registration.waiting = f.next; f.next.state = 'installed';
  f.next.dispatchEvent(new Event('statechange'));
  assert.equal(f.manager.getSnapshot().update, 'available');
  f.changeController(f.next);
  assert.equal(f.messages.length, 0); assert.equal(f.reloads, 0);
  assert.equal(f.controllerListeners.size, 0);
  first.manager.dispose(); f.manager.dispose();
});

test('offline and timed out checks remain retryable without accepting a late registration as success', async () => {
  const f = fixture();
  f.setOnline(false); await f.manager.checkForUpdates();
  assert.equal(f.manager.getSnapshot().update, 'offline'); assert.equal(f.registrations, 0);
  f.setOnline(true);
  f.env.register = () => new Promise(() => {});
  await f.manager.checkForUpdates(); assert.equal(f.manager.getSnapshot().update, 'timeout');
  f.env.register = async () => f.registration;
  await f.manager.checkForUpdates(); assert.equal(f.manager.getSnapshot().update, 'current');
  f.manager.dispose();
});

test('v3 without an acknowledgement and late activation use the close-old-windows fallback, without reload', async () => {
  for (const capability of [false, 'timeout'] as const) {
    const f = fixture(); f.registration.waiting = f.next;
    await f.manager.checkForUpdates();
    f.env.message = async (_worker, type) => {
      f.messages.push(type);
      return capability === 'timeout' ? new Promise<boolean>(() => {}) : false;
    };
    assert.equal(await f.manager.applyUpdate(), false);
    assert.equal(f.manager.getSnapshot().update, 'restart-required');
    assert.deepEqual(f.messages, ['PWA_UPDATE_CAPABILITIES']);
    f.changeController(f.next); assert.equal(f.reloads, 0); f.manager.dispose();
  }
  const f = fixture(); f.registration.waiting = f.next;
  await f.manager.checkForUpdates();
  assert.equal(await f.manager.applyUpdate(), false); // Acknowledged, but never took control.
  assert.equal(f.manager.getSnapshot().update, 'restart-required');
  f.changeController(f.next); assert.equal(f.reloads, 0); assert.equal(f.controllerListeners.size, 0);
  f.manager.dispose();
});

test('only the explicit applying tab reloads once, after the acknowledged waiting worker controls it', async () => {
  const f = fixture(); f.registration.waiting = f.next;
  await f.manager.checkForUpdates();
  const applying = f.manager.applyUpdate();
  await turn();
  assert.deepEqual(f.messages, ['PWA_UPDATE_CAPABILITIES', 'SKIP_WAITING']);
  assert.equal(f.reloads, 0);
  f.registration.installing = new Worker();
  f.registration.dispatchEvent(new Event('updatefound'));
  assert.equal(f.manager.getSnapshot().update, 'applying');
  f.registration.installing = null;
  assert.equal(await f.manager.applyUpdate(), false);
  f.changeController(new Worker()); assert.equal(f.reloads, 0);
  f.changeController(f.next); assert.equal(await applying, true); assert.equal(f.reloads, 1);
  f.changeController(f.next); assert.equal(f.reloads, 1); assert.equal(f.controllerListeners.size, 0);
  f.manager.dispose();
});

test('install prompts are single-use; dismissal and acceptance never fabricate installation completion', async () => {
  const f = fixture(); let calls = 0;
  f.manager.captureInstallPrompt({prompt: async () => {calls++;}, userChoice: Promise.resolve({outcome: 'dismissed'})});
  assert.equal(calls, 0); assert.equal(f.manager.getSnapshot().install, 'available');
  assert.equal(await f.manager.requestInstall(), false); assert.equal(calls, 1);
  assert.equal(f.manager.getSnapshot().install, 'dismissed');
  await f.manager.requestInstall(); assert.equal(calls, 1);
  f.manager.captureInstallPrompt({prompt: async () => {calls++;}, userChoice: Promise.resolve({outcome: 'accepted'})});
  assert.equal(await f.manager.requestInstall(), true);
  assert.equal(f.manager.getSnapshot().install, 'awaiting');
  f.manager.markInstalled(); assert.equal(f.manager.getSnapshot().install, 'installed');
  await f.manager.requestInstall(); assert.equal(calls, 2);
  const racing = fixture();
  let choose!: (choice: {outcome: 'accepted'}) => void;
  racing.manager.captureInstallPrompt({prompt: async () => {}, userChoice: new Promise(resolve => {choose = resolve;})});
  const request = racing.manager.requestInstall(); await turn();
  racing.manager.markInstalled(); choose({outcome: 'accepted'}); await request;
  assert.equal(racing.manager.getSnapshot().install, 'installed');
  const standalone = fixture({installed: () => true});
  assert.equal(standalone.manager.getSnapshot().install, 'installed');
  f.manager.dispose(); standalone.manager.dispose(); racing.manager.dispose();
});
