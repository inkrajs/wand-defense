import type { ArcanaDefinition, Grade } from '../contracts';
import type { CompiledSpell } from './compile';
import { gradedArcanaValue } from './grade-scaling';

// Resolve structural additions before capacity so placement order never changes a combination.
const order = ['pierce', 'slow', 'burn', 'knockback', 'duration', 'capacity', 'precision', 'homing', 'pursuit', 'ricochet', 'reclaim', 'domain', 'aftershock', 'martyrdom', 'resonance', 'elementalResonance'] as const;
export function isAdvancedModifier(modifier: ArcanaDefinition['modifier']): boolean {
  return order.some(value => value === modifier);
}
export interface AdjacentModifier { itemId: string; grade: Grade; definition: ArcanaDefinition }

/** Mutates only the detached compiled spell, using structures understood by the battle engine. */
export function applyAdvancedModifiers(spell: CompiledSpell, modifiers: AdjacentModifier[]): void {
  const attack = ['projectile', 'beam', 'chain', 'area'].includes(spell.effect)
    || (['summon', 'building'].includes(spell.effect) && spell.construct?.behavior === 'attack');
  const sorted = modifiers.filter(mod => isAdvancedModifier(mod.definition.modifier)).sort((a, b) =>
    order.findIndex(value => value === a.definition.modifier) - order.findIndex(value => value === b.definition.modifier)
      || (['domain', 'aftershock', 'martyrdom'].includes(a.definition.modifier)
        ? b.definition.value - a.definition.value : 0)
      || a.itemId.localeCompare(b.itemId));
  const seen = new Set<string>();
  let domainApplied = false;
  let aftershockApplied = false;
  for (const modifier of sorted) {
    if (seen.has(modifier.itemId)) continue;
    seen.add(modifier.itemId);
    const value = gradedArcanaValue(modifier.definition, modifier.grade);
    if (!Number.isFinite(value) || value <= 0) continue;
    let applied = false;
    switch (modifier.definition.modifier) {
      case 'pierce':
        if (spell.effect === 'projectile' && (!spell.impact || spell.impact.type === 'pierce')) {
          const previous = spell.impact?.maxTargets ?? 1;
          const next = Math.min(8, previous + Math.max(1, Math.floor(value)));
          if (next > previous) {
            spell.impact = { ...(spell.impact ?? { type: 'pierce' }), maxTargets: next };
            applied = true;
          }
        }
        break;
      case 'slow':
        if (attack && value < 1) {
          const old = spell.onHit?.slow;
          const multiplier = Math.max(0.1, Math.min(old?.multiplier ?? 1, value));
          const durationMs = Math.max(old?.durationMs ?? 0, 1500);
          if (!old || multiplier !== old.multiplier || durationMs !== old.durationMs) {
            spell.onHit = { ...spell.onHit, slow: { multiplier, durationMs } };
            applied = true;
          }
        }
        break;
      case 'burn':
        if (attack) {
          const old = spell.onHit?.burn;
          spell.onHit = { ...spell.onHit, burn: {
            powerRatio: (old?.powerRatio ?? 0) + value,
            durationMs: Math.max(old?.durationMs ?? 0, 3000),
            tickMs: Math.min(old?.tickMs ?? 500, 500),
          } };
          applied = true;
        }
        break;
      case 'knockback':
        if (attack) {
          const old = spell.onHit?.knockback ?? 0;
          const next = Math.min(12, old + value);
          if (next > old) { spell.onHit = { ...spell.onHit, knockback: next }; applied = true; }
        }
        break;
      case 'duration': {
        const extend = (spec: { durationMs: number }, maximum = 5000) => {
          const next = Math.min(maximum, spec.durationMs * value);
          if (next > spec.durationMs) { spec.durationMs = next; applied = true; }
        };
        if (spell.beam) extend(spell.beam);
        if (spell.impact?.type === 'field') extend(spell.impact);
        if (spell.area && ['field', 'vortex'].includes(spell.area.mode)) extend(spell.area);
        for (let stage = spell.area?.finish, depth = 0; stage && depth < 2; stage = stage.next, depth++) {
          if (stage.mode === 'field') extend(stage);
        }
        if (['summon', 'building'].includes(spell.effect) && spell.construct) extend(spell.construct, 30000);
        break;
      }
      case 'capacity': {
        const expand = (spec: { maxTargets: number }, maximum = 8) => {
          const next = Math.min(maximum, spec.maxTargets + Math.max(1, Math.floor(value)));
          if (next > spec.maxTargets) { spec.maxTargets = next; applied = true; }
        };
        if (spell.impact) expand(spell.impact);
        if (spell.beam) expand(spell.beam);
        if (spell.area) expand(spell.area, spell.area.mode === 'field' && spell.area.anchor === 'field' ? 64 : 8);
        for (let stage = spell.area?.finish, depth = 0; stage && depth < 2; stage = stage.next, depth++) expand(stage);
        if (['summon', 'building'].includes(spell.effect) && spell.construct) {
          const next = Math.min(8, spell.construct.maxAlive + Math.max(1, Math.floor(value)));
          if (next > spell.construct.maxAlive) { spell.construct.maxAlive = next; applied = true; }
        }
        break;
      }
      case 'homing':
      case 'pursuit':
        if (spell.effect === 'projectile') {
          const turnRate = Math.min(8, value);
          const reacquire = modifier.definition.modifier === 'pursuit';
          if (!spell.steering || turnRate > spell.steering.turnRate || (reacquire && !spell.steering.reacquire)) {
            spell.steering = { turnRate: Math.max(turnRate, spell.steering?.turnRate ?? 0), reacquire: reacquire || spell.steering?.reacquire };
            applied = true;
          }
        }
        break;
      case 'ricochet':
        if (spell.effect === 'projectile' && (!spell.impact || spell.impact.type === 'chain')) {
          const maxTargets = Math.min(4, Math.floor(value));
          if (maxTargets > (spell.impact?.maxTargets ?? 1)) {
            spell.impact = { type: 'chain', radius: Math.max(spell.impact?.radius ?? 0, 9), maxTargets,
              falloff: spell.impact?.falloff ?? .68 };
            applied = true;
          }
        }
        break;
      case 'reclaim':
        if (spell.effect === 'projectile' && spell.impact?.type !== 'field' && spell.manaCost > 0) {
          const rate = Math.min(.45, value);
          if (rate > (spell.manaRefundRatio ?? 0)) { spell.manaRefundRatio = rate; applied = true; }
        }
        break;
      case 'domain':
        if (spell.area?.mode === 'field' && spell.area.anchor !== 'field' && !spell.remainsAction && !spell.area.manaPerSecond) {
          if (value >= 2) {
            spell.area.anchor = 'field';
            spell.area.radius = Math.max(spell.area.radius, 100);
            spell.area.maxTargets = Math.max(8, spell.area.maxTargets);
            spell.power *= .55;
            spell.manaCost *= 1.65;
            spell.cooldownMs *= 1.35;
          } else if (!domainApplied) {
            spell.area.radius *= value;
            spell.area.durationMs *= 1.25;
            spell.manaCost *= 1.25;
          } else break;
          applied = domainApplied = true;
        }
        break;
      case 'aftershock':
        if (spell.area && !spell.remainsAction && (spell.area.mode === 'field' || spell.area.mode === 'vortex')
          && spell.area.anchor !== 'field' && !spell.area.finish?.next && !aftershockApplied) {
          const radius = Math.min(18, spell.area.radius);
          const stage = { mode: 'ring' as const, radius: radius * .72, durationMs: 220, maxTargets: 6, powerMultiplier: value };
          if (spell.area.finish) spell.area.finish.next = stage;
          else spell.area.finish = { ...stage, ...(value > .5 ? {
            next: { ...stage, radius, powerMultiplier: .55 },
          } : {}) };
          aftershockApplied = true;
          spell.manaCost *= 1.16;
          applied = true;
        }
        break;
      case 'martyrdom':
        if (spell.effect === 'summon' && spell.construct?.behavior === 'attack' && !spell.remainsAction
          && value > (spell.deathBurst ?? 0)) {
          spell.deathBurst = value;
          applied = true;
        }
        break;
      case 'precision':
        if (attack) {
          const next = Math.min(1, spell.attackRoll.accuracy + value);
          if (next > spell.attackRoll.accuracy) { spell.attackRoll.accuracy = next; applied = true; }
        }
        break;
    }
    if (applied) spell.modifierItemIds.push(modifier.itemId);
  }
}
