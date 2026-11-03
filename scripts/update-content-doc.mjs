// Run with: node --import tsx scripts/update-content-doc.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { demoContent } from '../src/content/demo.ts';
import { monsterDefinitions } from '../src/content/monsters.ts';
import { wandTemplates } from '../src/content/wands.ts';
import { enrichMagicReward } from '../src/content/magicDescriptions.ts';
const file = new URL('../docs/design/content.md', import.meta.url);
const start = '<!-- implemented-catalog:start -->';
const end = '<!-- implemented-catalog:end -->';
const safe = value => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
const json = value => value ? JSON.stringify(value) : '—';
const table = (headers, rows) => [headers, headers.map(() => '---'), ...rows].map(row => `| ${row.map(safe).join(' | ')} |`).join('\n');
const description = definition => enrichMagicReward({kind:'item',definitionId:definition.id},demoContent).description ?? '';
const counts = [demoContent.spells,demoContent.arcana,demoContent.gear,demoContent.items,monsterDefinitions,wandTemplates].map(group=>Object.keys(group??{}).length);
const parts = [start, '## 当前已实现内容目录（2026-11-04）',
`以下从实际定义生成，优先于后文的历史草案。共 **${counts.reduce((a,b)=>a+b,0)} 种**：法术 ${counts[0]}、奥术 ${counts[1]}、装备 ${counts[2]}、道具 ${counts[3]}、怪物 ${counts[4]}、额外法杖模板 ${counts[5]}；另有 ${demoContent.recipes.length} 条合成配方。初始 3×3 法杖是初始实例，不重复计入模板数。`,
'数值是当前原型的基础定义，不是平衡定案；实例品质、角色成长、装备、奖励、途径和相邻奥术会改变实际效果。空间使用 0～100 战场坐标，时间参数以毫秒计。定义全表仅供开发；普通 Agent 与游戏手册继续按玩家已知信息过滤。更新本段：`node --import tsx scripts/update-content-doc.mjs`。',
'### 法术',table(['ID / 名称','属性 / 类型','占格','力量 / 法力 / 冷却 / 射程','实际行为'],Object.values(demoContent.spells).map(d=>[`${d.id} / ${d.name}`,`${d.element} / ${d.effect}`,d.shape.map(p=>`${p.x},${p.y}`).join('; '),`${d.power} / ${d.manaCost} / ${d.cooldownMs} / ${d.range}`,description(d)])),
'### 召唤与建筑参数',table(['名称','生命 / 存续 / 间隔 / 同源上限','行为 / 攻击方式','移动 / 弹速 / 金币'],Object.values(demoContent.spells).filter(d=>d.construct).map(d=>[d.name,`${d.construct.hp} / ${d.construct.durationMs} / ${d.construct.attackIntervalMs} / ${d.construct.maxAlive}`,`${d.construct.behavior} / ${d.construct.attackMode}`,`${d.construct.moveSpeed??0} / ${d.construct.projectileSpeed??'—'} / ${d.construct.coinCost??0}`])),
'### 奥术',table(['ID / 名称','修饰 / 基础值','占格','效果'],Object.values(demoContent.arcana).map(d=>[`${d.id} / ${d.name}`,`${d.modifier} / ${d.value}`,d.shape.map(p=>`${p.x},${p.y}`).join('; '),description(d)])),
'### 装备（每件一格）',table(['ID / 名称','槽位','基础加成'],Object.values(demoContent.gear??{}).map(d=>[`${d.id} / ${d.name}`,d.slot,json(d.statBonuses)])),
'### 道具',table(['ID / 名称','基础效果','占格'],Object.values(demoContent.items??{}).map(d=>[`${d.id} / ${d.name}`,json(d.effect),d.shape.map(p=>`${p.x},${p.y}`).join('; ')])),
'### 怪物',table(['ID / 名称','尺寸','出生参数'],Object.values(monsterDefinitions).map(d=>[`${d.id} / ${d.name}`,d.bodySize,json(d.spawn)])),
'普通怪参数表示解锁波次、基础生命/伤害/速度/冷却的倍率，以及追踪/直行、护甲与恢复；Boss 使用实际波次计划的三档强化，缺省出生参数不代表无法出生。',
'### 额外法杖模板',table(['ID','定义'],Object.entries(wandTemplates).map(([id,d])=>[id,json(d)])),
'### 合成配方',table(['名称','材料 → 产物','邻接'],demoContent.recipes.map(d=>[d.name,`${d.inputs.join(' + ')} → ${d.output}`,d.requireAdjacency?'是':'否'])),end];
let document = readFileSync(file,'utf8');
const generated = parts.join('\n\n');
if (document.includes(start)) document = document.slice(0,document.indexOf(start))+generated+document.slice(document.indexOf(end)+end.length);
else document = document.replace('# 无尽巫师内容数据\n','# 无尽巫师内容数据\n\n'+generated+'\n');
writeFileSync(file,document);
console.log(`Updated implemented catalog: ${counts.join('/')} definitions, ${demoContent.recipes.length} recipes`);
