import type { CharacterInstance } from "../contracts";

export interface CharacterAnchor {
  characterId: string;
  x: number;
  y: number;
}

/** Evenly spaces character target points around the battlefield center line. */
export function getCharacterAnchors(
  characters: readonly Pick<CharacterInstance, "id">[],
): CharacterAnchor[] {
  const count = characters.length;
  if (count === 0) return [];
  const spacing = Math.min(24, 80 / Math.max(1, count - 1));
  return characters.map((character, index) => ({
    characterId: character.id,
    x: 50 + (index - (count - 1) / 2) * spacing,
    y: 84,
  }));
}

export function getCharacterAnchor(
  characters: readonly Pick<CharacterInstance, "id">[],
  characterId: string,
): CharacterAnchor | undefined {
  return getCharacterAnchors(characters).find(anchor => anchor.characterId === characterId);
}
