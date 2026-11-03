import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep a closing layer mounted briefly while making it inert immediately. */
export function MotionPresence({ active, className, children, label, containerRef }: { active: boolean; className: string; children: ReactNode; label?: string; containerRef?: React.Ref<HTMLDivElement> }) {
  const [retained, setRetained] = useState(active);
  const lastContent = useRef(children);
  if (active) lastContent.current = children;
  useEffect(() => {
    if (active) { setRetained(true); return; }
    const timer = window.setTimeout(() => setRetained(false), 280);
    return () => window.clearTimeout(timer);
  }, [active]);
  if (!active && !retained) return null;
  return <div ref={containerRef} className={`${className} motion-layer ${active ? "is-entering" : "is-exiting"}`} inert={!active} aria-hidden={!active || undefined} aria-label={label} tabIndex={label ? -1 : undefined} role={label ? "region" : undefined}>{active ? children : lastContent.current}</div>;
}
