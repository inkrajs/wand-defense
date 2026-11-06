import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { PencilIcon, PencilSurface, type PencilIconPath } from '@inkra/react';
import type { Command, CommandResult, GameEvent, GameState, GroundLoot } from '../contracts';
import { demoContent } from '../content/demo';
import { gradeDefinitions } from '../content/grades';
import { GearPresentationIcon, getGearPresentationIcon } from './gearPresentationIcons';
import { getSupplyPresentationIcon, SupplyPresentationIcon } from './supplyPresentationIcons';
import './GroundLoot.css';

const wandPaths: PencilIconPath[] = [
  { d: 'M5 19 17 7M14 5l1.2-2 1.1 2 2.2.4-1.6 1.5.3 2.2L15.2 8 13 9l.4-2.1-1.5-1.5Z', mode: 'stroke' },
  { d: 'M4 16l4 4', mode: 'stroke' },
];
const fallbackPaths: PencilIconPath[] = [{ d: 'M12 3 21 12 12 21 3 12Z', mode: 'stroke' }];

function label(loot: GroundLoot): string {
  if (loot.kind === 'wand') return loot.instance.name;
  return (loot.kind === 'gear' ? demoContent.gear?.[loot.definitionId]?.name : demoContent.items?.[loot.definitionId]?.name) ?? '物品';
}

const LootArtwork = memo(function LootArtwork({ loot }: { loot: GroundLoot }) {
  return <span className="ground-loot__art" style={{ '--loot-grade': gradeDefinitions[loot.instance.grade]?.color ?? 'var(--inkra-ink)' } as CSSProperties}>
    <PencilSurface as="span" className="ground-loot__surface" variant="outline" seed={`ground-loot-${loot.id}`} aria-hidden="true" />
    <span className="ground-loot__icon" aria-hidden="true">
      {loot.kind === 'gear' && getGearPresentationIcon(loot.definitionId)
        ? <GearPresentationIcon definitionId={loot.definitionId} size={26} seed={`ground-${loot.id}`} />
        : loot.kind === 'item' && getSupplyPresentationIcon(loot.definitionId)
          ? <SupplyPresentationIcon definitionId={loot.definitionId} size={26} seed={`ground-${loot.id}`} />
          : <PencilIcon paths={loot.kind === 'wand' ? wandPaths : fallbackPaths} size={26} sourceSize={24} seed={`ground-${loot.id}`} decorative />}
    </span>
  </span>;
}, (a, b) => a.loot.id === b.loot.id && a.loot.instance.grade === b.loot.instance.grade);

type Flight = { id: string; loot: GroundLoot; x: number; y: number; dx: number; dy: number; delay: number };

function eventLoot(event: GameEvent): GroundLoot | undefined {
  const { id, kind, x, y, enemyId, definitionId, instance } = event.data;
  if (typeof id !== 'string' || (kind !== 'gear' && kind !== 'item' && kind !== 'wand')
      || typeof x !== 'number' || !Number.isFinite(x) || typeof y !== 'number' || !Number.isFinite(y)
      || typeof enemyId !== 'string' || typeof definitionId !== 'string' || !instance || typeof instance !== 'object') return undefined;
  return { id, kind, x, y, enemyId, definitionId, instance } as GroundLoot;
}

const clampCoordinate = (value: number) => Math.max(0, Math.min(100, value));

/** The engine owns loot and awards; this layer only collects touched IDs and plays pickup feedback. */
export function GroundLootLayer({ state, dispatch, fieldRef }: {
  state: GameState; dispatch: (command: Command) => CommandResult; fieldRef: React.RefObject<HTMLDivElement | null>;
}) {
  const cursor = useRef({ runId: state.id, nextSeq: state.nextEventSeq });
  const requested = useRef(new Set<string>());
  const latest = useRef({ state, dispatch });
  latest.current = { state, dispatch };
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    if (cursor.current.runId !== state.id) {
      cursor.current = { runId: state.id, nextSeq: state.nextEventSeq };
      requested.current.clear();
      setFlights([]);
      return;
    }
    const after = cursor.current.nextSeq;
    cursor.current.nextSeq = Math.max(after, state.nextEventSeq);
    const events = state.events.filter(event => event.seq >= after && event.type === 'lootCollected');
    if (!events.length) return;
    const field = fieldRef.current?.getBoundingClientRect();
    const backpack = document.querySelector<HTMLElement>('.game-backpack > button')?.getBoundingClientRect();
    if (!field || !backpack) return;
    const targetX = backpack.left + backpack.width / 2;
    const targetY = backpack.top + backpack.height / 2;
    const fresh: Flight[] = [];
    for (const event of events) {
      const loot = eventLoot(event);
      if (!loot) continue;
      requested.current.delete(loot.id);
      const x = field.left + Math.min(Math.max(22, field.width * clampCoordinate(loot.x) / 100), Math.max(22, field.width - 22));
      const y = field.top + Math.min(Math.max(22, field.height * clampCoordinate(loot.y) / 100), Math.max(22, field.height - 22));
      // Drops from the same enemy would otherwise overlap for the whole flight.
      const sameSource = fresh.filter(flight => flight.loot.enemyId === loot.enemyId).length;
      fresh.push({ id: `${state.id}-${event.seq}`, loot, x, y, dx: targetX - x, dy: targetY - y, delay: Math.min(4, sameSource) * 70 });
    }
    if (fresh.length) setFlights(previous => [...previous, ...fresh].slice(-24));
  }, [state.id, state.events, state.nextEventSeq, fieldRef]);

  function collect(id: string) {
    if (requested.current.has(id)) return;
    requested.current.add(id);
    const result = latest.current.dispatch({ id: globalThis.crypto?.randomUUID?.() ?? `pickup-${Date.now()}-${Math.random()}`, type: 'pickupLoot', lootId: id });
    if (result.status === 'rejected') requested.current.delete(id);
  }

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    // Touch pointers retain their initial target while moving; hit-test the current location.
    const move = (event: globalThis.PointerEvent) => {
      if (event.pointerType === 'mouse' || !event.buttons) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-ground-loot-id]');
      const id = target?.dataset.groundLootId;
      if (id && latest.current.state.groundLoot?.some(loot => loot.id === id)) collect(id);
    };
    field.addEventListener('pointermove', move);
    return () => field.removeEventListener('pointermove', move);
  }, [fieldRef]);

  return <>
    <div className="ground-loot">
      {(state.groundLoot ?? []).map(loot => <button key={loot.id} type="button" className="ground-loot__item"
        data-ground-loot-id={loot.id} style={{ left: `clamp(22px, ${clampCoordinate(loot.x)}%, calc(100% - 22px))`, top: `clamp(22px, ${clampCoordinate(loot.y)}%, calc(100% - 22px))` }}
        aria-label={`拾取${label(loot)}`} title={`拾取${label(loot)}`}
        onPointerEnter={event => { if (event.pointerType === 'mouse' || event.pointerType === 'pen') collect(loot.id); }}
        onPointerDown={() => collect(loot.id)} onClick={() => collect(loot.id)}>
        <LootArtwork loot={loot} />
      </button>)}
    </div>
    {typeof document !== 'undefined' && createPortal(<div className="ground-loot__flights" aria-hidden="true">
      {flights.map(flight => <span key={flight.id} className="ground-loot__flight"
        style={{ left: flight.x, top: flight.y, '--loot-dx': `${flight.dx}px`, '--loot-dy': `${flight.dy}px`, '--loot-delay': `${flight.delay}ms` } as CSSProperties}
        onAnimationEnd={() => setFlights(previous => previous.filter(entry => entry.id !== flight.id))}>
        <LootArtwork loot={flight.loot} />
      </span>)}
    </div>, document.body)}
  </>;
}
