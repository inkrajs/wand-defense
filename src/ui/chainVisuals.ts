import type { CharacterAnchor } from "../content/characterAnchors";

/** Only a newly observed chain originating at its caster's world anchor is projected to the HUD. */
export function chainHudSource(data: Record<string, unknown>, anchors: readonly CharacterAnchor[], seen: Set<string>): string | undefined {
  if (typeof data.chainId !== "string" || !data.chainId || typeof data.sourceCharacterId !== "string") return undefined;
  if (seen.has(data.chainId)) return undefined;
  seen.add(data.chainId);
  if (seen.size > 256) seen.delete(seen.values().next().value!);
  const anchor = anchors.find(entry => entry.characterId === data.sourceCharacterId);
  return anchor && typeof data.x === "number" && typeof data.y === "number"
    && Math.abs(data.x - anchor.x) < 1e-6 && Math.abs(data.y - anchor.y) < 1e-6
    ? data.sourceCharacterId : undefined;
}
