/** Register only in production; waiting updates never interrupt a running game. */
export function registerPwa(): void {
  if (!import.meta.env.PROD || typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const register = () => {
    void navigator.serviceWorker.register(new URL("sw.js", base), { scope: base.pathname }).catch(() => {
      // Offline support is optional; registration failure must not affect the game.
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
