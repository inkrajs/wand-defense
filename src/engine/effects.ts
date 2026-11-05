import type { TacticalConstructState, TacticalFlightState } from "../contracts/tactical-arcana";
import type { AreaSpec, AttackRollStats, BeamSpec, ConstructSpec, ContentCatalog, Element, GameState, OnHitSpec, ProjectileImpact, ProjectileSteering, SpellTrigger } from "../contracts";
import { spawnProjectiles } from "./projectiles";
import { spawnBeams } from "./beams";
import { spawnAreaEffects } from "./areaEffects";
import { spawnChains } from "./chains";
import { castRemainsSpell } from "./remains";
import { getCharacterStats } from "../content/characters";
import { spawnConstructs } from "./constructs";

export interface CastSpec {
  itemId: string;
  definitionId: string;
  element?: Element;
  power: number;
  manaCost: number;
  cooldownMs: number;
  speed?: number;
  range: number;
  casts: number;
  burstCount?:number;
  splitCount?:number;
  attackRoll?: AttackRollStats;
  impact?: ProjectileImpact;
  beam?: BeamSpec;
  area?: AreaSpec;
  onHit?: OnHitSpec;
  construct?: ConstructSpec;
  position?: { x: number; y: number };
  trigger?: SpellTrigger;
  steering?: ProjectileSteering;
  manaRefundRatio?: number;
  deathBurst?: number;
  tacticalFlight?: TacticalFlightState;
  tacticalConstruct?: TacticalConstructState;
}

type Emit = (type: string, data: Record<string, unknown>) => void;

function findSourceCharacter(state: GameState, itemId: string, characterId: string) {
  const character = state.characters.find((entry) => entry.id === characterId);
  if (!character || !character.wandIds.some((id) => {
    const wand = state.wands.find((candidate) => candidate.id === id);
    return wand?.characterId === characterId && wand.placements.some((placement) => placement.itemId === itemId);
  })) return undefined;
  return character;
}

/** Launches real projectiles or heals territory. Caller owns mana and cooldowns. */
export function castSpell(
  state: GameState,
  characterId: string,
  spec: CastSpec,
  content: ContentCatalog,
  emit: Emit,
): boolean {
  const spell = content.spells[spec.definitionId];
  const item = state.items[spec.itemId];
  const character = findSourceCharacter(state, spec.itemId, characterId);
  if (!spell || spell.id !== spec.definitionId || item?.kind !== "spell" || item.definitionId !== spec.definitionId || !character) return false;

  const casts = Math.max(1, Math.floor(spec.casts));
  const amount = Math.max(0, spec.power);
  const onHit = spec.onHit ?? spell.onHit;
  const element = spec.element ?? spell.element;
  if (spell.remainsAction) {
    return castRemainsSpell(state, characterId, spell.remainsAction, { ...spec, element, onHit, construct: spec.construct ?? spell.construct, area: spec.area ?? spell.area }, emit);
  }
  if (spell.effect === "summon" || spell.effect === "building") {
    const construct = spec.construct ?? spell.construct;
    return construct ? spawnConstructs(state, characterId, { ...spec, kind: spell.effect, construct, onHit, element }, emit) : false;
  }
  if (spell.effect === "chain") {
    const impact = spec.impact ?? spell.impact;
    return impact?.type === "chain" ? spawnChains(state, characterId, { ...spec, impact, onHit, element }, emit) : false;
  }
  if (spell.effect === "projectile") {
    const ratio = Number.isFinite(spec.manaRefundRatio) ? Math.min(.45, Math.max(0, spec.manaRefundRatio!)) : 0;
    const ownCost = Math.max(0, spec.manaCost - (spec.trigger?.payload.manaCost ?? 0)
      - (spec.trigger?.additionalPayload?.manaCost ?? 0));
    const manaRefund = ratio > 0 && ownCost > 0 ? {
      amount: ownCost * ratio, maxMana: getCharacterStats(state, characterId, content)?.final.maxMana ?? character.maxMana,
    } : undefined;
    return spawnProjectiles(state, characterId, {
      ...spec,
      speed: spec.speed ?? spell.speed ?? 72,
      impact: spec.impact ?? spell.impact,
      onHit, element, manaRefund,
    }, emit);
  }

  if (spell.effect === "beam") {
    const beam = spec.beam ?? spell.beam;
    return beam ? spawnBeams(state, characterId, { ...spec, beam, onHit, element }, emit) : false;
  }
  if (spell.effect === "area") {
    const area = spec.area ?? spell.area;
    return area ? spawnAreaEffects(state, characterId, { ...spec, area, onHit, element }, emit) : false;
  }
  if (spell.effect === "shield") {
    if (state.territory.hp <= 0 || spec.range < 8) return false;
    const maxShield = state.territory.maxShield;
    if (maxShield === undefined || !Number.isFinite(maxShield) || maxShield <= 0) return false;
    let applied = false;
    for (let index = 0; index < casts; index++) {
      const restored = Math.min(amount,Math.max(0,maxShield - (state.territory.shield ?? 0)));
      if (restored <= 0) break;
      state.territory.shield = (state.territory.shield ?? 0) + restored;
      emit("shieldRestored",{targetId:"territory",sourceCharacterId:characterId,sourceItemId:spec.itemId,
        amount:restored,effect:spell.id,x:50,y:84});
      applied = true;
    }
    return applied;
  }

  if (spell.effect === "heal") {
    if (spec.range < 8 || state.territory.hp <= 0) return false;
    let applied = false;
    for (let index = 0; index < casts; index++) {
      const healed = Math.min(amount, state.territory.maxHp - state.territory.hp);
      if (healed <= 0) break;
      state.territory.hp += healed;
      emit("heal", { targetId: "territory", sourceCharacterId: characterId, sourceItemId: spec.itemId, amount: healed, effect: spell.id, x: 50, y: 84 });
      applied = true;
    }
    return applied;
  }

  return false;
}
