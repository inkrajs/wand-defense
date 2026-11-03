import type { ContentCatalog, Grade, RewardOption } from "../contracts";
import { rewardBuffValues, sampleWaveRewards } from "./randomRewards";
import { gradeDefinitions, gradeOrder } from "./grades";

/** Shared rarity values retained for consumers; rarity no longer fixes a card slot or wave. */
export const rewardGrades: {grade:Grade; name:string; attackPercent:number}[] = gradeOrder.map((grade,index) => ({
  grade, name:gradeDefinitions[grade].name, attackPercent:rewardBuffValues.attackPercent[index],
}));

/** Runtime supplies its saved RNG stream; semantic offers are sampled without replacement. */
export function createWaveRewards(wave:number, characterCount:number, wandCount:number, content:ContentCatalog,
  random?:()=>number, availability:{canHeal?:boolean;cooldownCapped?:boolean} = {}):RewardOption[] {
  let seed=(Math.floor(Number.isFinite(wave)?wave:1)^0x9e3779b9)>>>0;
  const draw=random??(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x1_0000_0000;});
  return sampleWaveRewards({wave,characterCount,wandCount,content,random:draw,...availability});
}
