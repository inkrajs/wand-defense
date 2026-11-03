# 构筑负责人
状态：原模块与真实背包法杖装备已集成；同物二合一品级升级已通过 Sol 验收，交 root/UI 接入。负责人 GPT-6.1 Sol；共享 checkout，仅拥有 src/loadout/** 和本记录。

## 编译接口（已冻结供战斗接入）
`import { compileWand } from '../loadout'`。
`compileWand(state, wandId, content): CompiledWand | undefined`；找不到法杖、角色或双向归属不一致时 undefined。
返回 `{ wandId, characterId, spells: CompiledSpell[] }`，按 placements 顺序。
`CompiledSpell` 为完整 `SpellDefinition` 字段（数值已应用修饰/当前序列），另外含 `itemId: string`, `copies: number`, `modifierItemIds: string[]`。
战斗使用 `spell.itemId` 存取 wand.cooldowns；一次触发支付一次 `manaCost`，产生 `copies` 次效果；使用已编译 power/range/cooldownMs/hp 等，勿再次乘序列。
仅四边邻接（多格任一边接触，单奥术对单法术只计一次）；amplify: power×value，double: copies×value，split: copies×value，focus: power×value/range×value；所有增殖修饰不重复加 manaCost。序列 `bonuses[element]` 以比例提升 power；summon/building 同时提升 hp，生成实体不再次加成。原型规则，数值按配置。
未知 item/definition 跳过；不修改 state/content。布局提交后调用即可得到新配置，无缓存。

## 子任务
- 几何：threadId `01a1a191-5bd1-73e3-98ef-89589ef54990`，host local，GPT-6 Luna/native；独占 `src/loadout/geometry.ts`、`geometry.test.ts`。已完成，实际代码已由 Sol 审查通过。
- 装备合成：threadId `01a1a191-5f08-70c3-8fd8-bb8a32ac61da`，host local，GPT-6 Luna/native；独占 `src/loadout/transactions.ts`、`transactions.test.ts`。已完成，实际代码已由 Sol 审查通过。
- 负责人：`src/loadout/index.ts`、`compile.ts`、`compile.test.ts`，集成、接口说明及 Sol 验收。

## 事务规则与暂定实现
当前 main 构筑规则：ready/reward 可整理；battle 须 paused；defeat 禁止（早期背包强制打开规则已被后续主线调整）。配方精确多重集且材料在同杖；邻接配方要求材料图四边连通；先校验后原子消耗，产物进背包避免空间失败；失败原 state 不变。合成产物同步当前玩家知识。法杖重归属保持双向一致，每角色最多两杖。
公共契约无变更请求。开放格洞口当前 WandInstance 无字段，首版按 width×height；需洞口扩展时由根协调者修改公共契约。

## 验证与验收
待实现后填写；UI 视觉由用户确认。

### 第一轮 Sol 审查
几何纯函数无状态/平台依赖，旋转归一化、多格边接触复用到编译与事务，符合分层；几何实际代码已审通过。
施法编译已落盘，按 placement 顺序生成 spell，奥术邻接每源一次，序列在生成实体前应用一次，复制 shape/asset 防外部修改定义。
已用 Node 22.21 原生 strip-types + 内联扩展名解析 hook 执行 geometry.test.ts 与 compile.test.ts，7/7通过，无依赖修改。npm脚本暂缺 tsx（根协调安装依赖中）。
事务初审发现 `areAdjacent(Cell,Cell)` 调用错误已交回；同时要求非法旋转拒绝、源定义存在、全局双向归属唯一、同杖重排保留冷却。尚未宣称事务完成。


## 最终 Sol 验收与交付
两个原生 Luna 子任务均已正常完成，未发生 provider/rate-limit 失败或模型切换。几何4用例、事务6用例、编译及真实事务链4用例，共14/14通过。
负责人实际阅读全部几何与事务代码：首次邻接参数错误、旋转运行时校验、唯一法杖声明、缺失材料定义、同杖重排冷却及完整返回路径已修正；补充了成功转杖与重复归属拒绝验证。Sol 结论：目标、分层、几何复用、配置驱动修饰及原子提交均通过。

调用流程：runtime 把四种构筑命令交 `applyLoadoutCommand` → 先检查暂停/来源/配方/几何 → 成功只提交一次 state/revision/events；engine 每次读取 `compileWand` → 使用已算序列/奥术的 power/hp/range 和 copies，按 itemId 保存独立冷却。UI/HTTP 无规则副本。

实际验证：
- `npm exec -- tsx --test src/loadout/*.test.ts`：14/14通过。
- 定向 TypeScript strict（仅 loadout 入口、三份测试及其导入，`--ignoreConfig --types node --target ES2022 --module ESNext --moduleResolution Bundler --esModuleInterop --skipLibCheck --noEmit`）：通过。
- `git diff --check`：通过。
- 未由本模块重复执行全仓 build；根协调者统一验证；未做 AI 视觉验收，界面效果仍由用户确认。

范围限制：目前矩形法杖，无公共开放格洞口字段；等级/品级保存但未额外推导数值成长；split 原型按 copies 表达，与 double 同为增殖机制，后续可按效果处理器扩展分裂弹道；合成产物进背包。装备卸下会清除该杖该物品冷却；同杖直接重摆保留冷却。状态快照隔离与 command.id 幂等属于根 runtime。

## 增量：真实法杖装备（契约提案，root 已采纳落盘）
最小字段改动：`WandInstance.characterId: Id | null`，null 明确表示法杖存放在背包；不新增 `ItemInstance.kind`，不把 wandId 混入仅存法术/奥术的 `GameState.backpack`。背包法杖列表由 `state.wands.filter(w => w.characterId === null)` 投影，避免增加第三份位置真值。
新增命令 `{ id, type: 'unequipWand', wandId }`；复用 `equipWand` 从背包或其他角色装备。原有每角色最多2杖及暂停/phase规则保持当前main行为（ready/reward可整理；battle须paused；defeat拒绝）。
不变量：已装备法杖恰好被其characterId对应角色的wandIds声明一次；未装备法杖不被任何角色声明。装备/卸下不改placements/cooldowns；失败保持原状态。卸下保留整杖法术布局，内部物品仍只在该杖，背包法杖不能施法。
事件：`wandEquipped {wandId,fromCharacterId:Id|null,characterId}`；`wandUnequipped {wandId,fromCharacterId}`。未装备重复卸下返回ALREADY_UNEQUIPPED，重复装备现角色返回ALREADY_EQUIPPED。
root 接线：共享类型、runtime命令路由（包括允许命令校验/协议若有白名单）、背包奖励法杖初始characterId=null、未装备杖在engine跳过、UI背包投影。无需新护甲/头盔成长规则。
本模块本轮独占 src/loadout/** 与本记录，不改contracts/runtime/UI/content，不提交。

### 本轮并行文件边界
- 复用事务 Luna：threadId `01a1a191-5f08-70c3-8fd8-bb8a32ac61da`，GPT-6 Luna/native，本轮仅 `src/loadout/equipment.ts`；装备/卸下纯事务已完成并通过 Sol 验收。
- 复用几何 Luna：threadId `01a1a191-5bd1-73e3-98ef-89589ef54990`，GPT-6 Luna/native，本轮仅 `src/loadout/equipment.test.ts`；独立验收场景已完成并通过 Sol 验收。
- Sol 负责人：`transactions.ts` 路由、`transition.ts` 共用提交语义、`compile.ts` 未装备防护；最终实际代码审查/针对性检查。本轮不派生更多任务。

### 增量最终交付（Sol 验收通过）
root 已采纳 null 单真值方案并落共享 contracts/runtime/agent 接线，未新增 backpackWandIds。本模块实际完成：
- `equipment.ts` 装备/卸下事务：先验证唯一法杖实例、全体角色声明和当前归属，再检查目标存在、同目标重复及2杖容量；通过 `transition.ts` 一次不可变提交。
- `transactions.ts` 复用装备事务路由；原有法术放置、移除、合成行为不变。
- `compile.ts` 显式拒绝 characterId=null；engine 现main按归属过滤天然不会触发背包杖。
- `equipment.test.ts` 强类型命令测试：卸下→背包→新角色装备保留布局/冷却、序列重编译11→12、事件seq/time/revision；目标满、重复卸下、重复角色声明、null归属残留声明失败原状态不变；战斗暂停限制。

两个复用子任务均正常完成，GPT-6 Luna/native，未切模型、未发生provider失败；最新文件边界如上。Sol 实际逐段阅读两个新增文件及整合 diff：目标、纯领域分层、公共提交复用、归属一致性及配置驱动扩展通过，测试中临时类型断言已移除。
验证：首次 `npm exec -- tsx --test src/loadout/*.test.ts` 17/17通过；测试收尾增加null残留声明断言后仅复跑 `equipment.test.ts` 3/3通过。定向strict TypeScript（loadout入口及测试导入，显式`--types node`）通过；`git diff --check`通过。未跑全仓build，不改UI/contracts/runtime/content、不提交。
调用：UI以`state.wands.filter(w=>w.characterId===null)`展示可拖法杖；装备槽发equipWand，回背包发unequipWand，经runtime统一入口处理。卸下整根法杖保留其中法术；此处的法杖卸下保留全部cooldowns，区别于removeItem移除单法术的既有规则。背包三行polyomino排布、拖拽手势和角色页视觉均由Terra实现，等待用户确认；领域不臆造护甲内容。

## 同物二合一品级升级（已通过 Sol 验收）
子任务沿用 native GPT-6 Luna：`01a1a191-5f08-70c3-8fd8-bb8a32ac61da` 仅 `merge-items.ts`；`01a1a191-5bd1-73e3-98ef-89589ef54990` 仅 `merge-items.test.ts`。Sol负责compile/grade-scaling、transition/transactions/index和最终实际验收。禁止写其他模块/提交。
UI接口 `canMergeItems(state,sourceItemId,targetItemId,content):boolean` 纯候选，拖动本身无提交；松手仅dispatch `mergeItems`。同definition/kind/grade二合一升一档、mythic封顶；不要求level相同，产物level=max。新ID`${command.id}:merged`，目标bag相对位置或wand placement顺序/坐标/旋转保留，其他物品不吞。配方mergeRecipe仍独立。
品级强度暂定数据：共用gradePower实例/定义参考grade比值乘法术power；grade/level元数据来自实例。Arcana amplify/focus只放大(value-1)增量，double/split从定义grade起每升一档+1 copies；临时参数在`grade-scaling.ts`，相同grade保持旧效果。序列照旧，runBonuses只增强projectile，heal仅品级/序列成长。
冷却：transition.maxItemCooldown取两实例跨全部wand ledger的最大有限非负值；合并产物继承最大值，bag中产物暂存ledger，placeItem迁移最大值，removeItem保留ledger直到再装回，避免卸下/合并重置。无新公共字段。

### 二合一最终 Sol 验收
两条 Luna 原生子任务均正常完成、无模型故障/切换：执行任务 `01a1a191-5f08-70c3-8fd8-bb8a32ac61da` 仅新增 `merge-items.ts`；测试任务 `01a1a191-5bd1-73e3-98ef-89589ef54990` 仅新增 `merge-items.test.ts`。Sol 实际阅读实现、测试、编译增量、冷却转移调用流，已清理重复定义检查，检查目标位置、其他物品和配置引用未被修改。
调用流：UI `canMergeItems`→共享validateMerge只读；放手dispatch mergeItems→applyLoadoutCommand→applyMergeItemsCommand再次校验→commit一次更新revision/events；拖开无需命令。输出ID碰撞只在提交时判定，候选没有commandId不预测它。事件`itemsMerged {sourceItemId,targetItemId,outputItemId,definitionId,grade}`。
Sol结论：二合一约束、品级实际增强、分层复用、公共数据驱动、最高档封顶、冷却承接均通过。保留root现有runBonuses攻击百分比计算及其projectile限定。
实际验证：
- `npm exec -- tsx --test src/loadout/*.test.ts`：26/26通过。含真实merge→compile增强、法术/奥术两类、bag/wand/跨wand、目标顺序/旋转、max level、grade上限/不匹配/重复位置/ID冲突、pure候选/取消不变、冷却转移与bag再装、旧配方/装备回归。
- 定向strict TypeScript（loadout入口与全部5份测试及导入，显式types node、ES2022/Bundler）：通过。
- `git diff --check`：通过。
初轮曾21/23通过，两个失败均测试预期错误：wand上的无关物品不应被期望出现在bag；canMerge无commandId不能判断产物ID冲突。已纠正并完成上面最终验证，没有隐瞒失败。
未跑全仓build，不改contracts/runtime/ui/agent/engine/content，不提交。UI拖拽高亮和松手行为由Terra接此纯domain API，视觉留待用户确认。
本轮冷却规则覆盖早期记录：removeItem现在保留detached ledger；placeItem读取跨wand最大值并迁移，避免卸下再装备/合并消除冷却；背包冷却是否递减沿用承载wand的现有游戏时钟，无新时间源或领域副本。
