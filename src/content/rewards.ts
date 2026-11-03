import type { ContentCatalog, Grade, RewardOption } from "../contracts";
import { gradeDefinitions } from "./grades";

export const rewardGrades: {grade:Grade; name:string; attackPercent:number}[] = [
  {grade:"common",name:"白板",attackPercent:10},
  {grade:"uncommon",name:"精良",attackPercent:15},
  {grade:"rare",name:"稀有",attackPercent:20},
  {grade:"epic",name:"史诗",attackPercent:30},
  {grade:"legendary",name:"传说",attackPercent:40},
  {grade:"mythic",name:"神话",attackPercent:50},
];

const rewardItemCycle = [
  "water-bolt", "wind-blade", "lightning-bolt", "rock-shot",
  "amplify", "double", "metal-needle", "regrowth", "split", "focus",
] as const;

/** Demo reward data; tier pacing and values are prototype balance choices. */
export function createWaveRewards(wave: number, characterCount: number, wandCount: number, content: ContentCatalog): RewardOption[] {
  const tier = rewardGrades[Math.min(rewardGrades.length - 1,Math.max(0,Math.floor((wave - 1) / 3)))];
  const waveIndex = Math.max(0, Math.floor(wave) - 1);
  const definitionId = rewardItemCycle[waveIndex % rewardItemCycle.length];
  const definition = content.spells[definitionId] ?? content.arcana[definitionId];
  const id = `reward-${wave}`;
  const options: RewardOption[] = [{
    id:`${id}-attack`,kind:"buff",grade:tier.grade,label:`攻击提升 ${tier.attackPercent}%`,
    description:"增强本局全队的攻击魔法。",effect:{type:"attackPercent",value:tier.attackPercent},
    details:[{label:"攻击加成",value:`+${tier.attackPercent}%`},{label:"作用范围",value:"本局全队攻击魔法"},
      {label:"叠加方式",value:"同类百分比相加"},{label:"品级",value:gradeDefinitions[tier.grade].name}],
  }];
  if (definition) options.push({
    id:`${id}-item`,kind:"item",definitionId,grade:definition.grade,label:definition.name,
    description:content.spells[definitionId] ? "获得一个魔法，存入共享背包。" : "获得一个奥术，存入共享背包。",
    details:[{label:"存放位置",value:"共享背包"},{label:"等级",value:String(definition.level)},
      {label:"占用格数",value:String(definition.shape.length)}],
  });
  options.push({id:`${id}-heal`,kind:"heal",grade:"common",amount:35,label:"生命恢复",
    description:"领地恢复 35 点生命。",details:[{label:"恢复量",value:"35"},{label:"恢复上限",value:"不超过生命上限"},{label:"护盾",value:"不恢复"}]});
  if (characterCount < 3 && (wave === 1 || wave % 3 === 0)) {
    options.push({id:`${id}-character`,kind:"character",grade:"rare",label:"同行者",
      description:"招募一名角色，携带一根初始法杖。",details:[{label:"去向",value:"当前队伍"},{label:"初始等级",value:"1"}]});
  } else if (wandCount < characterCount * 2) {
    options.push({id:`${id}-wand`,kind:"wand",grade:"uncommon",label:"备用法杖",
      description:"获得一根法杖，存入共享装备背包。",details:[{label:"法杖槽位",value:"3 × 3"},{label:"初始状态",value:"未装备"}]});
  } else {
    options.push({id:`${id}-coins`,kind:"coins",grade:"uncommon",amount:20,label:"金币",
      description:"获得 20 金币。",details:[{label:"获得数量",value:"20"},{label:"去向",value:"本局金币"}]});
  }
  return options;
}
