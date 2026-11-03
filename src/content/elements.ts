import type { Element } from "../contracts";

/** Element changes the wash; rarity independently owns the border. */
export const elementAppearances = {
  fire:{name:"火",pigment:"var(--game-element-fire, #df7950)"},
  wood:{name:"木",pigment:"var(--game-element-wood, #71a56b)"},
  metal:{name:"金",pigment:"var(--game-element-metal, #d2ad52)"},
  water:{name:"水",pigment:"var(--game-element-water, #659dbd)"},
  earth:{name:"土",pigment:"var(--game-element-earth, #b18d65)"},
  light:{name:"光",pigment:"var(--game-element-light, #e5cf83)"},
  dark:{name:"暗",pigment:"var(--game-element-dark, #937aaf)"},
  lightning:{name:"雷",pigment:"var(--game-element-lightning, #c5af4b)"},
  wind:{name:"风",pigment:"var(--game-element-wind, #70b4a7)"},
} as const satisfies Record<Element,{name:string;pigment:string}>;
export const neutralMagicPigment = "var(--game-element-neutral, #aaa596)";
