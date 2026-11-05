import type { ArcanaDefinition, Cell, ContentCatalog, SpellTrigger, TriggerPayload, WandInstance } from '../contracts';
import type { CompiledSpell } from './compile';
import { areAdjacent, placementCells } from './geometry';

import { TRIGGER_LIMITS } from '../contracts/trigger-limits';
export function isTriggerModifier(modifier: ArcanaDefinition['modifier']): boolean {
  return modifier === 'hitTrigger' || modifier === 'timerTrigger' || modifier === 'rangeTrigger' || modifier === 'linkedCast';
}
type Modifier = { itemId: string; definition: ArcanaDefinition; cells: Cell[] };

/** Resolve unambiguous two-spell bridges in grid order, without depending on placement insertion order. */
export function composeSpellTriggers(spells: CompiledSpell[], wand: WandInstance, modifiers: Modifier[], content: ContentCatalog): void {
  const triggers = modifiers.filter(mod => isTriggerModifier(mod.definition.modifier) || mod.definition.modifier === 'condense');
  if (triggers.length === 0) return;
  const placements = new Map(wand.placements.map(placement => [placement.itemId, placement]));
  const order = (a: { itemId: string }, b: { itemId: string }) => {
    const first = placements.get(a.itemId)!, second = placements.get(b.itemId)!;
    return first.y - second.y || first.x - second.x || a.itemId.localeCompare(b.itemId);
  };
  const reserved = new Set<string>();
  for (const modifier of triggers.sort(order)) {
    if (!Number.isFinite(modifier.definition.value) || modifier.definition.value <= 0) continue;
    const adjacent = spells.filter(spell => areAdjacent(
      placementCells(content.spells[spell.id].shape, placements.get(spell.itemId)!), modifier.cells,
    )).sort(order);
    const linked = modifier.definition.modifier === 'linkedCast';
    if (adjacent.length !== (linked && modifier.definition.value === 2 ? 3 : 2)) continue;
    const [carrier, payload] = adjacent;
    if (adjacent.some(spell => reserved.has(spell.itemId)) || carrier.effect !== 'projectile') continue;
    if (modifier.definition.modifier === 'condense') {
      if (carrier.id !== payload.id || payload.effect !== 'projectile') continue;
      carrier.power = (carrier.power + payload.power) * modifier.definition.value;
      carrier.manaCost += payload.manaCost;
      carrier.cooldownMs = Math.max(carrier.cooldownMs, payload.cooldownMs) * 1.25;
      carrier.copies = carrier.burstCount = carrier.splitCount = 1;
      carrier.condensedItemId = payload.itemId;
      carrier.modifierItemIds.push(modifier.itemId);
      payload.modifierItemIds.push(modifier.itemId);
      payload.triggeredByItemId = carrier.itemId;
      reserved.add(carrier.itemId); reserved.add(payload.itemId);
      continue;
    }
    if (![carrier.manaCost, carrier.cooldownMs].every(value => Number.isFinite(value) && value >= 0)) continue;
    const payloads = adjacent.slice(1).map(snapshotPayload);
    const [first, additional] = payloads;
    if (!first || (payloads.length > 1 && !additional)) continue;
    const trigger: SpellTrigger = {
      mode: linked || modifier.definition.modifier === 'hitTrigger' ? 'hit'
        : modifier.definition.modifier === 'rangeTrigger' ? 'range' : 'timer',
      delayMs: Math.max(TRIGGER_LIMITS.minDelayMs, Math.min(TRIGGER_LIMITS.maxDelayMs, modifier.definition.value)),
      modifierItemId: modifier.itemId, payload: first,
      ...(additional ? { additionalPayload: additional } : {}),
      ...(linked ? { releaseAtRange: true } : {}),
    };
    carrier.trigger = trigger;
    if (linked) {
      // Linked casts pay their full load even on a missed carrier and release only once per cast.
      carrier.copies = carrier.burstCount = carrier.splitCount = 1;
    }
    for (const linkedSpell of adjacent.slice(1)) {
      carrier.manaCost += linkedSpell.manaCost;
      carrier.cooldownMs = Math.max(carrier.cooldownMs, linkedSpell.cooldownMs);
      linkedSpell.modifierItemIds.push(modifier.itemId);
      linkedSpell.triggeredByItemId = carrier.itemId;
    }
    carrier.modifierItemIds.push(modifier.itemId);
    for (const spell of adjacent) reserved.add(spell.itemId);
  }
}


function snapshotPayload(payload: CompiledSpell): TriggerPayload | undefined {
  if ((payload.effect !== 'area' && payload.effect !== 'projectile')
    || payload.remainsAction || (payload.effect === 'area' && !payload.area)
    || ![payload.manaCost, payload.cooldownMs].every(value => Number.isFinite(value) && value >= 0)) return undefined;
  const copies = Math.min(TRIGGER_LIMITS.payloadCopies, payload.copies);
  return {
    itemId: payload.itemId, definitionId: payload.id, effect: payload.effect, element: payload.element,
    power: payload.power, manaCost: payload.manaCost, cooldownMs: payload.cooldownMs,
    range: payload.range, ...(payload.speed !== undefined ? { speed: payload.speed } : {}),
    casts: copies, burstCount: Math.min(copies, payload.burstCount), splitCount: Math.min(copies, payload.splitCount),
    ...(payload.impact ? { impact: structuredClone(payload.impact) } : {}),
    ...(payload.area ? { area: structuredClone(payload.area) } : {}),
    ...(payload.onHit ? { onHit: structuredClone(payload.onHit) } : {}),
    ...(payload.steering ? { steering: { ...payload.steering } } : {}),
    attackRoll: { ...payload.attackRoll },
  };
}
