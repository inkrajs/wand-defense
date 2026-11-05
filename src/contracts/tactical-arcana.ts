/** One family per mechanical rule; the recipe's value selects its tier. */
export type TacticalModifier = "charge" | "compression" | "spread" | "branding"
  | "freezing" | "conductivity" | "armorBreak" | "returnFlight" | "fanShot"
  | "resplit" | "constructPayload" | "reinforcement" | "symbiosis" | "sacrifice";

export interface TacticalHit {
  branding?: 1 | 2;
  freezing?: 1 | 2;
  conductivity?: 1 | 2;
  armorBreak?: 1 | 2;
}

export interface TacticalFlight {
  returnFlight?: 1 | 2;
  fanShot?: 1 | 2;
  resplit?: 1 | 2;
}

export interface TacticalConstruct {
  constructPayload?: 1 | 2;
  reinforcement?: 1 | 2;
  symbiosis?: 1 | 2;
  sacrifice?: 1 | 2;
}

export interface TacticalStatus {
  brand?: { owner?: string; untilMs: number; tier: 1 | 2 };
  frozenUntilMs?: number;
  conductiveUntilMs?: number;
  exposedUntilMs?: number;
}

export interface TacticalFlightState extends TacticalFlight {
  returning?: true;
  volleyOffset?: number;
}

export interface MountedSpell {
  itemId: string;
  definitionId: string;
  element: import("./index").Element;
  power: number;
  range: number;
  speed: number;
  attackRoll: import("./index").AttackRollStats;
  impact?: import("./index").ProjectileImpact;
}

export interface TacticalConstructState extends TacticalConstruct {
  mounted?: MountedSpell;
  alternate?: boolean;
}
