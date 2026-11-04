import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { RuntimePort } from "../contracts";

/** Hidden debug discovery: a deliberate hold on the hero entry, or five rapid title clicks. */
export function useDebugUnlock(runtime: RuntimePort) {
  const [shaking, setShaking] = useState(false);
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClick = useRef(false);
  const clicks = useRef({ count: 0, last: 0 });
  function cancelHold() {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  }
  function unlock() {
    if (runtime.getState().cheats.unlocked) return;
    const result = runtime.dispatch({ id: crypto.randomUUID(), type: "unlockCheats" });
    if (result.status === "rejected") return;
    setShaking(true);
    clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 480);
    try { navigator.vibrate?.(40); } catch { /* Optional device feedback. */ }
  }
  useEffect(() => {
    window.addEventListener("blur", cancelHold);
    return () => { window.removeEventListener("blur", cancelHold); cancelHold(); clearTimeout(shakeTimer.current); };
  }, [runtime]);
  return {
    shaking,
    onTitleClick() {
      const now = performance.now();
      clicks.current.count = now - clicks.current.last < 600 ? clicks.current.count + 1 : 1;
      clicks.current.last = now;
      if (clicks.current.count === 5) { clicks.current.count = 0; unlock(); }
    },
    holdHandlers: {
      onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
        cancelHold(); suppressClick.current = false;
        if (event.button !== 0 || runtime.getState().cheats.unlocked) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        hold.current = { x: event.clientX, y: event.clientY, timer: setTimeout(() => {
          hold.current = null; suppressClick.current = true; unlock();
        }, 3000) };
      },
      onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
        if (hold.current && Math.hypot(event.clientX - hold.current.x, event.clientY - hold.current.y) > 8) cancelHold();
      },
      onPointerUp: cancelHold,
      onPointerCancel: cancelHold,
      onLostPointerCapture: cancelHold,
      onContextMenu(event: React.MouseEvent<HTMLButtonElement>) { event.preventDefault(); },
      onClickCapture(event: React.MouseEvent<HTMLButtonElement>) {
        if (suppressClick.current) { suppressClick.current = false; event.preventDefault(); event.stopPropagation(); }
      },
    },
  };
}
