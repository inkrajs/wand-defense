import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { GamePencilShape } from './GamePencilShape';
import type { WandRecipeHint, WandRecipeHints as HintMap } from './wandRecipeHintModel';
import './WandRecipeHints.css';

function useReducedMotion() {
  const read = () => typeof window !== 'undefined' && (window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.dataset.gameReduceMotion === 'true');
  const [reduced, setReduced] = useState(read);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(read());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-game-reduce-motion'] });
    media.addEventListener('change', update);
    update();
    return () => { media.removeEventListener('change', update); observer.disconnect(); };
  }, []);
  return reduced;
}

function HintWash({ hint, cellSize }: { hint: WandRecipeHint; cellSize: number }) {
  const minX = Math.min(...hint.cells.map(cell => cell.x));
  const minY = Math.min(...hint.cells.map(cell => cell.y));
  const width = (Math.max(...hint.cells.map(cell => cell.x)) - minX + 1) * cellSize;
  const height = (Math.max(...hint.cells.map(cell => cell.y)) - minY + 1) * cellSize;
  return <span className="wand-recipe-hints__wash" data-recipe-materials={JSON.stringify(hint.itemIds)} style={{ left: minX * cellSize, top: minY * cellSize, width, height }}>
    <GamePencilShape geometry={{ type: 'cells', cells: hint.cells, cellSize: 1 }} width={width} height={height} fit="stretch"
      color="var(--inkra-selection-pigment)" inkDensity={1.2} outlineColor="var(--inkra-selection-foreground)"
      outlineWidth={1.4} seed={`wand-recipe-${hint.key}`} decorative />
  </span>;
}

function BoardHints({ layers, cellSize }: { layers: WandRecipeHint[][]; cellSize: number }) {
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  const signature = JSON.stringify(layers.map(layer => layer.map(hint => hint.key)));
  useEffect(() => {
    setRound(0);
    if (reduced || layers.length <= 1) return;
    const timer = window.setInterval(() => setRound(previous => (previous + 1) % layers.length), 2400);
    return () => window.clearInterval(timer);
  }, [signature, reduced, layers.length]);
  // With reduced motion, show every real group without cycling or flashing.
  const visible = reduced ? layers.flat() : layers[round % layers.length];
  return <div className="wand-recipe-hints" aria-hidden="true">{visible.map(hint => <HintWash key={hint.key} hint={hint} cellSize={cellSize} />)}</div>;
}

/** Attach to the public inventory board, so its native zoom and dragging stay intact. */
export function WandRecipeOverlays({ hostRef, hints, cellSize, enabled }: {
  hostRef: RefObject<HTMLElement | null>; hints: HintMap; cellSize: number; enabled: boolean;
}) {
  const [boards, setBoards] = useState<Array<{ wandId: string; node: HTMLElement }>>([]);
  const wandIds = JSON.stringify([...hints.keys()]);
  useLayoutEffect(() => {
    // The enclosing host's ref is attached after this child's layout effect.
    const frame = requestAnimationFrame(() => {
      const host = hostRef.current;
      const wanted = new Set<string>(JSON.parse(wandIds));
      const next = !enabled || !host ? [] : [...host.querySelectorAll<HTMLElement>('.inkra-inventory-grid__board[data-inventory-container]')]
        .flatMap(node => {
          const id = node.dataset.inventoryContainer;
          return id?.startsWith('wand:') && wanted.has(id.slice(5)) ? [{ wandId: id.slice(5), node }] : [];
        });
      setBoards(previous => previous.length === next.length && previous.every((entry, index) => entry.node === next[index].node) ? previous : next);
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, hostRef, wandIds]);
  return <>{enabled && boards.map(({ wandId, node }) => {
    const layers = hints.get(wandId);
    return layers?.length ? createPortal(<BoardHints layers={layers} cellSize={cellSize} />, node, wandId) : null;
  })}</>;
}
