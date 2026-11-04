export interface PwaWorker extends Pick<EventTarget, 'addEventListener' | 'removeEventListener'> {
  readonly state: ServiceWorkerState;
  postMessage(message: unknown, transfer: Transferable[]): void;
}
export interface PwaRegistration extends Pick<EventTarget, 'addEventListener' | 'removeEventListener'> {
  readonly waiting: PwaWorker | null;
  readonly installing: PwaWorker | null;
  readonly active: PwaWorker | null;
  update(): Promise<unknown>;
}
export interface InstallPrompt {
  prompt(): Promise<unknown>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}
export type UpdateStatus = 'unavailable' | 'idle' | 'checking' | 'downloading' | 'current' | 'offline-ready' | 'available' | 'applying' | 'offline' | 'timeout' | 'failed' | 'restart-required';
export type InstallStatus = 'unavailable' | 'manual' | 'available' | 'prompting' | 'awaiting' | 'dismissed' | 'installed' | 'failed';
export interface PwaState {
  update: UpdateStatus;
  install: InstallStatus;
  online: boolean;
  controlled: boolean;
  supported: boolean;
  production: boolean;
}
export interface PwaEnvironment {
  production: boolean;
  supported: boolean;
  online(): boolean;
  installed(): boolean;
  controller(): PwaWorker | null;
  register(): Promise<PwaRegistration>;
  message(worker: PwaWorker, type: 'PWA_UPDATE_CAPABILITIES' | 'SKIP_WAITING'): Promise<boolean>;
  onControllerChange(listener: () => void): () => void;
  reload(): void;
  now?: () => number;
  timeoutMs?: number;
  throttleMs?: number;
}

class DeadlineError extends Error {}
function deadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DeadlineError()), ms);
    promise.then(value => {clearTimeout(timer); resolve(value);}, error => {clearTimeout(timer); reject(error);});
  });
}

/** Browser events and user actions share one store; no timers poll during ordinary play. */
export function createPwaManager(env: PwaEnvironment) {
  const timeoutMs = env.timeoutMs ?? 12_000;
  const listeners = new Set<() => void>();
  const tracked = new Set<PwaRegistration>();
  const cleanups: Array<() => void> = [];
  let registration: PwaRegistration | undefined;
  let prompt: InstallPrompt | undefined;
  let pending: Promise<boolean> | undefined;
  let lastCheck = -Infinity;
  let disposed = false;
  let cancelApply: (() => void) | undefined;
  let state: PwaState = {
    production: env.production, supported: env.supported, online: env.online(), controlled: Boolean(env.controller()),
    update: !env.production || !env.supported ? 'unavailable' : 'idle',
    install: !env.production ? 'unavailable' : env.installed() ? 'installed' : 'manual',
  };
  const emit = (patch: Partial<PwaState>) => {
    if (disposed) return;
    state = {...state, ...patch};
    listeners.forEach(listener => listener());
  };
  function inspect() {
    if (disposed || state.update === 'applying') return;
    const controller = env.controller();
    const waiting = registration?.waiting;
    const update: UpdateStatus = waiting && controller && waiting !== controller ? 'available'
      : registration?.installing ? 'downloading'
      : registration?.active && !controller ? 'offline-ready' : 'current';
    emit({update, controlled: Boolean(controller), online: env.online()});
  }
  function trackWorker(worker: PwaWorker) {
    const changed = () => {
      if (worker.state === 'redundant' && state.update !== 'applying') emit({update: env.online() ? 'failed' : 'offline'});
      else if (worker.state === 'installed' || worker.state === 'activated') inspect();
    };
    worker.addEventListener('statechange', changed);
    cleanups.push(() => worker.removeEventListener('statechange', changed));
    changed();
  }
  function track(next: PwaRegistration) {
    registration = next;
    if (tracked.has(next)) return;
    tracked.add(next);
    const found = () => {
      if (next.installing) {
        if (state.update !== 'applying') emit({update: 'downloading'});
        trackWorker(next.installing);
      }
    };
    next.addEventListener('updatefound', found);
    cleanups.push(() => next.removeEventListener('updatefound', found));
    found();
  }
  function waitInstalled(worker: PwaWorker): Promise<void> {
    if (worker.state === 'installed' || worker.state === 'activated') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer); worker.removeEventListener('statechange', changed);
        if (error) reject(error); else resolve();
      };
      const changed = () => {
        if (worker.state === 'installed' || worker.state === 'activated') finish();
        else if (worker.state === 'redundant') finish(new Error());
      };
      const timer = setTimeout(() => finish(new DeadlineError()), timeoutMs);
      worker.addEventListener('statechange', changed);
      changed();
    });
  }
  async function performCheck(): Promise<boolean> {
    emit({update: 'checking', online: true});
    try {
      if (!registration) track(await deadline(env.register(), timeoutMs));
      if (disposed) return false;
      if (!registration!.waiting) {
        await deadline(registration!.update(), timeoutMs);
        if (registration!.installing) await waitInstalled(registration!.installing);
      }
      inspect();
      return state.update === 'available';
    } catch (error) {
      if (state.update === 'applying') return false;
      emit({update: !env.online() ? 'offline' : error instanceof DeadlineError ? 'timeout' : 'failed', online: env.online()});
      return false;
    }
  }
  function checkForUpdates(manual = true): Promise<boolean> {
    if (disposed || !env.production || !env.supported) return Promise.resolve(false);
    if (state.update === 'applying') return Promise.resolve(false);
    if (!env.online()) {
      emit({online: false, update: registration?.waiting && env.controller() ? 'available' : 'offline'});
      return Promise.resolve(false);
    }
    if (pending) return pending;
    const now = (env.now ?? Date.now)();
    if (!manual && now - lastCheck < (env.throttleMs ?? 60_000)) return Promise.resolve(state.update === 'available');
    lastCheck = now;
    pending = performCheck().finally(() => {pending = undefined;});
    return pending;
  }
  async function applyUpdate(): Promise<boolean> {
    if (disposed || !env.production || !env.supported || state.update === 'applying') return false;
    const worker = registration?.waiting;
    if (!worker || !env.controller() || worker === env.controller()) return false;
    emit({update: 'applying'});
    try {
      if (!await deadline(env.message(worker, 'PWA_UPDATE_CAPABILITIES'), timeoutMs)) {
        emit({update: 'restart-required'}); return false;
      }
    } catch {
      emit({update: 'restart-required'}); return false;
    }
    if (disposed) return false;
    // Only this explicit action installs a controller listener that may reload this tab.
    return new Promise(resolve => {
      let finished = false;
      const finish = (success: boolean) => {
        if (finished) return;
        finished = true; clearTimeout(timer); unsubscribe(); cancelApply = undefined;
        if (success) {resolve(true); env.reload();}
        else {emit({update: 'restart-required'}); resolve(false);}
      };
      const unsubscribe = env.onControllerChange(() => {
        if (env.controller() === worker) finish(true);
      });
      const timer = setTimeout(() => finish(false), timeoutMs);
      cancelApply = () => finish(false);
      void deadline(env.message(worker, 'SKIP_WAITING'), timeoutMs).then(accepted => {
        if (!accepted) finish(false);
      }, () => finish(false));
    });
  }
  function refreshEnvironment() {
    emit({online: env.online(), controlled: Boolean(env.controller()),
      ...(env.installed() ? {install: 'installed' as const} : {})});
    if (!env.online() && !['available', 'applying', 'restart-required', 'unavailable'].includes(state.update)) emit({update: 'offline'});
  }
  function captureInstallPrompt(next: InstallPrompt) {
    if (!env.production || state.install === 'installed' || disposed) return;
    prompt = next; emit({install: 'available'});
  }
  function markInstalled() {prompt = undefined; emit({install: 'installed'});}
  const hasInstalled = () => state.install === 'installed';
  async function requestInstall(): Promise<boolean> {
    if (!env.production || disposed || !prompt || hasInstalled()) return false;
    const requested = prompt; prompt = undefined; emit({install: 'prompting'});
    try {
      await requested.prompt();
      const choice = await requested.userChoice;
      if (!hasInstalled()) emit({install: choice.outcome === 'accepted' ? 'awaiting' : 'dismissed'});
      return choice.outcome === 'accepted';
    } catch {if (!hasInstalled()) emit({install: 'failed'}); return false;}
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener);};},
    checkForUpdates, applyUpdate, refreshEnvironment, captureInstallPrompt, markInstalled, requestInstall,
    dispose() {disposed = true; cancelApply?.(); cleanups.forEach(cleanup => cleanup()); listeners.clear();},
  };
}
