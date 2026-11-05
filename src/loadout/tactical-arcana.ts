import type { ArcanaDefinition } from "../contracts";
import type { TacticalModifier } from "../contracts/tactical-arcana";
import type { CompiledSpell } from "./compile";

const modifiers = new Set<string>(["charge", "compression", "spread", "branding",
  "freezing", "conductivity", "armorBreak", "returnFlight", "fanShot", "resplit",
  "constructPayload", "reinforcement", "symbiosis", "sacrifice"]);

export function isTacticalModifier(modifier: string): modifier is TacticalModifier {
  return modifiers.has(modifier);
}


export interface TacticalNeighbor {
  itemId: string;
  definition: Omit<ArcanaDefinition, "modifier"> & { modifier: string };
}

/** Resolve strongest variants once per family. A modifier is listed only if it applies. */
export function applyTacticalModifiers(spell: CompiledSpell, neighbors: readonly TacticalNeighbor[]): void {
  let byFamily: Map<TacticalModifier, TacticalNeighbor> | undefined;
  for (const entry of neighbors) {
    const family = entry.definition.modifier;
    if (!isTacticalModifier(family)) continue;
    byFamily ??= new Map();
    const existing = byFamily.get(family);
    if (!existing || existing.definition.value < entry.definition.value) byFamily.set(family, entry);
  }
  if (!byFamily) return;
  for (const family of modifiers) {
    if (!isTacticalModifier(family)) continue;
    const entry = byFamily.get(family);
    if (!entry) continue;
    const tier = entry.definition.value >= 2 ? 2 : 1;
    if (applyModifier(spell, family, tier)) spell.modifierItemIds.push(entry.itemId);
  }
}

function applyModifier(spell: CompiledSpell, family: TacticalModifier, tier: 1 | 2): boolean {
  const area = spell.area;
  const attack = ["projectile", "chain", "area", "beam"].includes(spell.effect)
    || (spell.effect === "summon" || spell.effect === "building") && spell.construct?.behavior === "attack";
  switch (family) {
    case "charge":
      if (!attack) return false;
      spell.power *= tier === 1 ? 1.35 : 1.8;
      spell.cooldownMs *= tier === 1 ? 1.42 : 1.8;
      spell.manaCost *= tier === 1 ? 1.08 : 1.45;
      return true;
    case "compression":
      if (area && area.anchor !== "field" && !area.shower && !spell.remainsAction) {
        area.radius *= .62;
        if (area.pullRadius !== undefined) area.pullRadius *= .62;
        spell.power *= 1.37;
        if (tier === 2 && area.mode === "field" && !area.finish) {
          area.finish = { mode: "strike", radius: area.radius * .68, durationMs: 350, maxTargets: 6, powerMultiplier: 2.4 };
          spell.manaCost *= 1.24;
        }
        return true;
      }
      if (tier === 1 && (spell.impact?.type === "splash" || spell.beam)) {
        if (spell.impact?.type === "splash") spell.impact.radius *= .62;
        if (spell.beam) spell.beam.width *= .62;
        spell.power *= 1.37;
        return true;
      }
      return false;
    case "spread":
      if (!area || area.mode !== "field" || area.anchor === "field" || spell.remainsAction) return false;
      if (tier === 2) area.expandDuringMs = Math.max(area.expandDuringMs ?? 0, Math.round(area.durationMs * .7));
      area.radius = Math.min(38, area.radius * (tier === 1 ? 1.35 : 1.62));
      spell.power *= tier === 1 ? .83 : .88;
      spell.manaCost *= 1.14;
      return true;
    case "branding":
    case "freezing":
    case "conductivity":
    case "armorBreak":
      if (!attack || (family === "freezing" && tier === 1 && spell.element !== "water")
        || (family === "conductivity" && spell.element !== "lightning")) return false;
      spell.onHit = { ...spell.onHit, tactical: { ...spell.onHit?.tactical, [family]: tier } };
      return true;
    case "returnFlight":
    case "fanShot":
    case "resplit":
      if (spell.effect !== "projectile" || (family !== "fanShot" && spell.impact?.type === "field")
        || (family === "returnFlight" && spell.impact)) return false;
      spell.tacticalFlight = { ...spell.tacticalFlight, [family]: tier };
      if (family === "fanShot") {
        spell.splitCount = Math.max(3, spell.splitCount);
        if (tier === 2) spell.burstCount = Math.max(2, spell.burstCount);
        spell.power *= tier === 1 ? .68 : .55;
      }
      if (family === "resplit") spell.manaCost *= tier === 1 ? 1.15 : 1.3;
      return true;
    case "constructPayload":
    case "reinforcement":
    case "symbiosis":
    case "sacrifice":
      if (spell.effect !== "summon" || !spell.construct || spell.remainsAction) return false;
      if ((family === "constructPayload" || family === "symbiosis") && spell.construct.behavior !== "attack") return false;
      spell.tacticalConstruct = { ...spell.tacticalConstruct, [family]: tier };
      return true;
  }
}

/** Bind the closest in board order, not by instance creation order. Only plain projectile snapshots travel with summons. */
export function bindTacticalMounts(
  spells: readonly CompiledSpell[],
  touchesMount: (summon: CompiledSpell, projectile: CompiledSpell) => boolean,
): void {
  for (const summon of spells) {
    const tactic = summon.tacticalConstruct;
    if (!tactic?.constructPayload) continue;
    const projectile = spells.find(candidate => candidate.effect === "projectile" && !candidate.trigger
      && !candidate.triggeredByItemId && touchesMount(summon, candidate));
    if (!projectile) continue;
    tactic.mounted = {
      itemId: projectile.itemId, definitionId: projectile.id, element: projectile.element,
      power: projectile.power * (tactic.constructPayload === 1 ? .5 : .4),
      range: Math.min(30, projectile.range), speed: projectile.speed ?? 72,
      attackRoll: { ...projectile.attackRoll },
      ...(projectile.impact && projectile.impact.type !== "field"
        ? { impact: { ...projectile.impact, maxTargets: Math.min(3, projectile.impact.maxTargets) } } : {}),
    };
    summon.manaCost += Math.min(25, Math.max(3, projectile.manaCost * .7));
  }
}
