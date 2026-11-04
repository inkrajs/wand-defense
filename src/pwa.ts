import { createPwaManager, type InstallPrompt, type PwaWorker } from './pwa/state';

const browser = typeof window !== 'undefined' && typeof navigator !== 'undefined';
const production = import.meta.env?.PROD === true;
const supported = browser && 'serviceWorker' in navigator;
const installedDisplay = () => browser && (window.matchMedia('(display-mode: standalone)').matches
  || window.matchMedia('(display-mode: minimal-ui)').matches
  || (navigator as Navigator & {standalone?: boolean}).standalone === true);
const base = browser ? new URL(import.meta.env?.BASE_URL ?? '/', window.location.origin) : undefined;

/** A bounded acknowledgement distinguishes the old v3 worker from the new handler. */
function messageWorker(worker: PwaWorker, type: 'PWA_UPDATE_CAPABILITIES' | 'SKIP_WAITING'): Promise<boolean> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = (accepted: boolean) => {clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(accepted);};
    const timer = setTimeout(() => finish(false), 4_000);
    channel.port1.onmessage = event => {
      const reply = event.data;
      finish(reply?.protocol === 1 && (type === 'PWA_UPDATE_CAPABILITIES'
        ? reply.type === 'PWA_UPDATE_CAPABILITIES' && reply.canSkipWaiting === true
        : reply.type === 'PWA_UPDATE_ACCEPTED'));
    };
    try {worker.postMessage({type, protocol: 1}, [channel.port2]);}
    catch {finish(false);}
  });
}

const manager = createPwaManager({
  production, supported,
  online: () => !browser || navigator.onLine !== false,
  installed: installedDisplay,
  controller: () => supported ? navigator.serviceWorker.controller : null,
  register: () => navigator.serviceWorker.register(new URL('sw.js', base!).href, {scope: base!.pathname, updateViaCache: 'none'}),
  message: messageWorker,
  onControllerChange(listener) {
    navigator.serviceWorker.addEventListener('controllerchange', listener);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', listener);
  },
  reload: () => window.location.reload(),
});

export const getPwaState = manager.getSnapshot;
export const subscribePwa = manager.subscribe;
export const checkPwaUpdate = () => manager.checkForUpdates(true);
export const applyPwaUpdate = manager.applyUpdate;
export const installPwa = manager.requestInstall;

export function getInstallInstructions(): string {
  if (!browser) return '请使用浏览器菜单中的安装或添加到主屏幕。';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return '在 Safari 中点“分享”，再选“添加到主屏幕”；如在其它应用内，请先用 Safari 打开。';
  if (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|OPR|Android/.test(navigator.userAgent)) {
    return '在 Safari 的分享菜单中选择“添加到程序坞”或“添加到主屏幕”；是否可用由当前系统决定。';
  }
  return '可在浏览器菜单中选择“安装应用”或“添加到主屏幕”；若没有该项，请使用支持安装的浏览器。';
}

let started = false;
/** Capture installation early, then check on load/foreground/online; never poll in development. */
export function registerPwa(): void {
  if (started || !production || !browser) return;
  started = true;
  window.addEventListener('beforeinstallprompt', event => {
    const candidate = event as Event & Partial<InstallPrompt>;
    if (typeof candidate.prompt !== 'function' || !candidate.userChoice) return;
    event.preventDefault(); manager.captureInstallPrompt(candidate as Event & InstallPrompt);
  });
  window.addEventListener('appinstalled', manager.markInstalled);
  for (const mode of ['standalone', 'minimal-ui']) {
    window.matchMedia(`(display-mode: ${mode})`).addEventListener('change', manager.refreshEnvironment);
  }
  const automaticCheck = () => {manager.refreshEnvironment(); void manager.checkForUpdates(false);};
  window.addEventListener('online', automaticCheck);
  window.addEventListener('offline', manager.refreshEnvironment);
  document.addEventListener('visibilitychange', () => {if (document.visibilityState === 'visible') automaticCheck();});
  if (document.readyState === 'complete') automaticCheck();
  else window.addEventListener('load', automaticCheck, {once: true});
}
