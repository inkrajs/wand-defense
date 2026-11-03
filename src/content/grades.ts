import type { Grade } from "../contracts";

/** Game rarity policy, shared by characters, equipment and rewards. */
export const gradeDefinitions = {
  common: {name:"白板",color:"var(--game-grade-common, #a6adb4)"},
  uncommon: {name:"精良",color:"var(--game-grade-uncommon, #56845c)"},
  rare: {name:"稀有",color:"var(--game-grade-rare, #4778b5)"},
  epic: {name:"史诗",color:"var(--game-grade-epic, #8555a6)"},
  legendary: {name:"传说",color:"var(--game-grade-legendary, #bb922e)"},
  mythic: {name:"神话",color:"var(--game-grade-mythic, #d97835)"},
} as const satisfies Record<Grade,{name:string;color:string}>;

export const gradeOrder: readonly Grade[] = ["common","uncommon","rare","epic","legendary","mythic"];
/** Prototype strength scale; content balance can change without rewriting merge transactions. */
export const gradePower: Record<Grade,number> = {common:1,uncommon:1.25,rare:1.5,epic:2,legendary:2.6,mythic:3.4};
