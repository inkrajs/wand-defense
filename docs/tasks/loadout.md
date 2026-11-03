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

## 本局累计统计（2026-11-04）
Sol直接实现，无新子任务。本轮仅拥有 runtime/runStatistics.ts、其test、runtime/index.ts与initial.ts；未动UI/投影/契约。
`createRunStatistics():RunStatistics` 新局全0、version1、complete true；`restoreRunStatistics(state,content)` 保留合法存档统计，缺失/非法则恢复确认下界、complete false；`accumulateBattleStatistics(stats,transition.events,positiveCoinDelta)` 只累计本次真实引擎事件。
运行时giveItem成功才分spell/arcana+1（自然/等级奖励/作弊均覆盖），角色领取+1、奖励金币收入+正值；tick enemyKilled统计含首领boss-minor/major/apex，waveCleared+1，characterLevelUp按level-previousLevel累计，多级不漏；金币只tick正差与奖励收入，支出不扣统计。初始配置、整理、装备、合并输出均不作新获取。原runtime幂等先返回receipt，不重复累计；复活保留，restart归零，checkpoint保存，独立于512事件裁剪。
旧档下界：非初始实际实例数（排除:merged/:output产物，避免仅初始材料合成被误认获取）与已选奖励history获取数取max不重复相加；角色当前数量-1与历史招募数取max；当前每角色level-1总和与保留事件等级差取max；击杀/首领/清波仅保留事件确认数；金币max(当前余额,保留战斗收入+历史金币奖励)。任何旧档恢复均不宣称精确。
Sol实际检查目标、事件语义、纯helper/权威runtime分层、无倒扣/重复累加；4项meaningful tests通过（发放幂等/合并不计，实际引擎击杀/首领清波与跨级，金币招募/520事件裁剪刷新/重试/复活/重开，旧档下界），定向strict TS与diff --check通过。没有操作当前用户局，无提交或全仓测试。领地repairTerritory将仅接战斗方helper，不复制修复规则。
修复追加接线已完成：runtime/index权威路由把repairTerritory交给战斗方`applyTerritoryRepair`，复用原receipt幂等，不复制价格/phase/补满规则。新增真实路由用例验证补满扣币、coinsEarned保持、重复命令不扣费。最终5/5定向tests、定向strict TS、拥有文件范围diff检查通过；全仓其他worker临时空行未改。runtime入口本轮工作已交根集成。

## 装备与普通药水（本轮进行中）
用户/root授权两域独立原生Luna执行，Sol实际审查与集成：
- `01a1a191-5f08-70c3-8fd8-bb8a32ac61da`，GPT-6 Luna/native，本轮仅 `src/loadout/gear.ts`、`gear.test.ts`：装备替换/跨owner解绑/卸下/丢弃及实际final属性验证。
- `01a1a191-5bd1-73e3-98ef-89589ef54990`，GPT-6 Luna/native，本轮仅 `src/runtime/supplies.ts`、`supplies.test.ts`：药水grade比恢复、最终maxMana、满值与阶段拒绝及丢弃。
- Sol仅接loadout/transactions.ts与index.ts装备三路，root持runtime/index与工厂，不覆盖；UI/projection/protocol/存档均不属于本模块。
接口冻结：applyGearCommand(state,command,content):CommandTransition；applySupplyCommand(state,command,content):CommandTransition。gear未装备留state.gear且characterId=null，不混magic backpack；supplies为独立record。药水仅缺量有收益时删除一实例，gradePower实例/定义比增强，partyMana按getCharacterStats.final.maxMana。装备/药水不减少runStatistics，不删knowledge、不返金币。gear卸下后mana clamp由root统一处理。
事件：gearEquipped/gearUnequipped/gearDiscarded与itemUsed/supplyDiscarded显式IDs/slot/owner；itemUsed含effectType、amount实际恢复总量及party targets[{characterId,amount}]。候选hover不执行命令。
供应品实现初审通过主流程，已交回补ownkey、正safe level、负mana与TS外command边界；待两子任务最终代码与针对验证，暂不称完成。

### 装备/药水最终 Sol 验收
两原生Luna子任务已交回实现：gear域6项、supply域5项通过，未发生provider失败/模型切换。Sol实际逐段复读gear登记key/ID/slot/definition与全角色声明、同slot旧gear验证、跨owner解绑与单次commit；复读药水grade比、最终maxMana、实际恢复和空收益拒绝、实例删除与保留其他状态。审查要求的ownkey、正safe level、负mana、严格phase及未知旧定义装备可卸下清理均已补齐。
Sol另建 `gear-integration.test.ts`：经公共applyLoadoutCommand装备→compile火花从11变15.4（攻击+4且序列×1.1），再用药水把mana从90补到装备扩展后的130，消费一份，输入/统计不变；增补alias/stale-owner/wrong-slot三场景原子拒绝。
验证记录：gear6+supply5+首个集成用例合跑12/12；新增归属矩阵后仅重跑集成文件2/2。总13项相关用例均通过；定向strict TS与拥有文件diff检查通过。首个集成预期曾漏算序列倍率，纠正测试后通过，未改编译规则。没有全仓循环或UI视觉验收。
调用：root runtime gear三命令经applyLoadoutCommand→applyGearCommand，root supplies二命令直接applySupplyCommand(state,command,content)；沿用统一receipt幂等。gear变更后root按新final.maxMana clamp；工厂与catalog由root/战斗方提供，gear实例statBonuses已经被getCharacterStats真实读取。库存gear与supplies独立，不混魔法背包。不操作用户当前局，不改runtime/index、UI/projection/protocol/contracts/内容库或提交。
gearEquipped事件含gearId/characterId/fromCharacterId/slot及replacedGearId；unequipped含gearId/fromCharacterId/slot；gearDiscarded含gearId/可选definitionId。itemUsed含itemId/definitionId/effectType/amount与party targets逐角色实际量（满者0）；supplyDiscarded含itemId/definitionId。
Sol结论：目标、分层、事务复用、实际属性效果与扩展性通过；界面效果由用户确认。根可继续统一整合。

## clearWand一键卸下（Sol直接实现并验收）
新增`clear-wand.ts`的`applyClearWandCommand(state,command):CommandTransition`，经transactions/index统一路由。严格phase/唯一wand ID/角色双向归属/全体物品map身份与唯一真实引用预校验；失败原state/events[]。成功一次commit/event `wandCleared {wandId,returnedItemIds,count}`，按placements顺序追加原bag，不重排原bag、不删除实例、不改knowledge/stats/coins/其他wand/发射实体，保留完整cooldowns ledger。空wand仍executed单事件且冷却不变。无需循环dispatch removeItem；幂等沿根runtime receipt。
Sol实际审查+4项定向tests通过（原子全卸+保序冷却再装、未知/重复/异常拒绝、空杖/phase、真实发射后clear再命中）；定向strict TS、范围diff检查通过。仅新增clear-wand.ts/test、transactions/index与本记录，不改根runtime/protocol/UI或用户当前局，无提交/全仓测试。

## 五种新增奥术（已通过Sol验收）
原生并行任务：`01a1a191-5f08-70c3-8fd8-bb8a32ac61da` GPT-6 Luna/native仅compile.ts；`01a1a191-5bd1-73e3-98ef-89589ef54990` GPT-6 Luna/native仅content/expandedArcana.ts。数据与编译均已实际落盘，无provider故障/模型切换。Sol本人负责grade-scaling.ts、modifiers.test.ts、全代码审查与接线协调；不改demo/engine/contracts/runtime/存档。
新增导出expandedArcana/expandedArcanaDescriptions，稳定IDs：haste迅捷CD×.85、efficiency节能mana×.8、reach延展range×1.25、velocity疾行projectile speed×1.3、area广域beam.width与splash/chain半径及area.radius×1.3。仅四边邻接每源一次，velocity仅飞弹，area仅有范围几何的法术，不适用修饰不冒称applied；多个修饰独立乘法组合。ring实际几何取compiled range，因此广域还乘ring range。新增shape为1/1/2/2/3格，全部level1 common。短描述百分比是common模板基础值，不是角色/品级最终结算；battle负责demo append与magicDescriptions语义映射。
品级公式：新增modifier=1+(baseValue-1)×gradePower(instance)/gradePower(definition)，haste/efficiency最低乘数.1保护，当前mythic=.49/.32；其他原四种规则不变。保留root最新isAttack含area、nested area clone和所有角色/序列/发射模式逻辑。战斗方effects优先spec.impact/beam/area，未吞编译几何；两负责人已对齐。
Sol实际逐段阅读数据、compile switch/条件/clone与grade公式，验收目标、分层、复用、扩展性与真实数值通过。新modifiers5/5与旧compile7/7定向通过，strict TS与拥有文件diff检查通过。新用例实际stepBattle证明mana92、cooldown850、projectile speed130（common基准100/1000/100）；ring实际cast/区域伤害radius32.5命中原射程外敌人，beam/splash/chain/strike/eruption配置均缩放，grade uncommon/mythic更强且输入定义不变。首次测试误把无范围的普通飞弹也期望记录area应用，已修正测试符合实际适用性，无规则倒退；未跑全仓或视觉验收。
本轮未擅自grant当前存档，不引入反射/追踪等新行为，无提交。数据/编译ownership释放给root统一整合。

### 全魔法路线追加关键配方验证
数据模块magicRecipes.ts实际落盘后，仅新增expanded-recipes.test.ts，无事务/数据/引擎修改。2/2真实流程通过：thunder-strike-recipe雷矢+聚焦→落雷（strike）；earth-spikes-recipe岩刺+新area广域→地刺（eruption）。经public placeItem合法多格放置、已知配方门禁、非邻接原子拒绝、mergeRecipe一次消费不同定义、产物入bag并发现、重新place/compile得到真实area配置；不混同名二合一升品，不增加获取统计。定向strict TS与该文件diff检查通过，未跑全仓或当前局。

### 持续领域广域与四/六发增量
契约实际落盘后，Sol仅改compile广域两处纳入impact.type field，并对area.mode vortex的已配置pullRadius同乘；原area.radius对field/vortex继续适用，不修改moveSpeed/pullStrength/timing/anchor。新增expanded-modifiers.test.ts验证几何和不变项。
原数据作者`01a1a191-5bd1-73e3-98ef-89589ef54990` GPT-6 Luna/native复用独占expandedArcana.ts，已实际交回quadruple“四发”value4完整2×2、sextuple“六发”value6完整3×2，common/level1、均复用double modifier与现有gradedArcanaValue。不改union/castPattern。对应Descriptions读取definition.value基础次数并说明120ms，避免把所有double强称双发；battle负责demo/手册映射。旧5条未改。
Sol读码/数据审查通过，新3/3目标测试通过：field/vortex半径；common真实生成4/6个projectile且delay为0/120/...；mythic quad9×sext11→burst64、split7组合仍实际64发，前两次各7同时分支。compile/data独立strict TS与范围diff通过。新测试完整类型链在对方engine/impact.ts49尚未区分field与chain时遇falloff TS2339，已精确通知battle负责人，不越界修改/不冒称该链TS已通过。root engine正在并行实现，不重复跑旧大套。没有grant存档/提交或UI操作。

### 雷暴三输入与即时雷链追加
仅在expanded-recipes.test.ts追加真实三材料雷暴：thunder-field-bolt完整2×2、area L、double横2格在5×5上连通（不要求全互邻）；第三份移开则INPUTS_NOT_ADJACENT原子拒绝，成功单次revision/event消费3材料、保留无关bag/统计、完整3×3九格产物可重新place/compile anchor field。读取实际已落fieldSpells.ts合成测试catalog，不越界修改demo或配方定义；1/1新目标运行及定向strict TS通过，未重跑旧配方套件。
root确认即时雷链契约后compile仅isAttack追加chain，攻击数值结算保留；velocity原projectile-only不作用chain，广域impact.chain.radius、burst/split/attackRoll照旧。该单行定向compile strict TS与范围diff通过，compile ownership已释放，未碰effects/engine/data或存档。

### onHit编译快照（Sol直接bounded验收）
root实际落OnHitSpec后，仅compile.ts新增onHit/slow/burn三层显式克隆，全部数值原样保留；burn.powerRatio不再乘品级，真实伤害由已成长后的source.damage驱动。新增on-hit-snapshot.test.ts一项双向隔离断言（catalog改不改旧snapshot，snapshot改不污染catalog），另确认13.75成长伤害时ratio仍.25；首轮精确浮点断言13.750000000000002已改容差。最终1/1、定向strict TS、范围diff通过，无新child/全矩阵/engine修改。已通知root与battlelead并释放compile，不触当前局或提交。

## 队伍采集与金币入账（Sol直接实现/验收）
本轮无子任务。只接content/characters.ts、gear.ts、新economy.ts及相应定向tests，不写contracts/root runtime/engine/UI/存档。
权威属性层新增normalized base/equipment.gatheringPercent缺省0，run同字段缺省0；有限非负采集值每源保护至1e6，负数/NaN/Infinity不造成加成；gear与wand真实双向装备规则仍由getCharacterStats汇总。新增一格accessory `gatherer-charm`“采集符”基础+10%，加入gear statKeys经gradePower工厂缩放（rare+15%），原8装备效果不变。
`getGatheringStats(state,content?) -> {base,equipment,run,total,multiplier}`：当前characters数组即上场队伍，读唯一有效角色的权威base/equipment，run全队只加一次，不乘角色数。
`grantCoinIncome(state,baseAmount,content?) -> {baseAmount,amount,bonusAmount,gatheringPercent,remainder}`：唯一正收入入口，仅mutate coins和coinIncomeRemainder，不emit/统计/RNG。计算floor(base*(1+total/100)+carry)，浮点极近整数按小epsilon纠偏；余数0..1保存。余额已有小数保留；非正/非有限或溢出收入no-op，不用它处理支出。只有真实正入账才算队伍加成，没有新增tick扫描/计时器。
Sol读码自审数值边界/属性复用/归属与运行路径通过；新经济5项及characters10/gear-supplies8回归共23/23，定向strict TS、范围diff通过。验证多角色run只一次、未装备/错owner不算、装卸真实生效、1币+10%十次实得11、JSON保存恢复carry、无采集收入一致/小数余额保留、NaN/负数/零/溢出不动状态，统计/事件/随机源未被helper修改。首轮2项旧精确对象断言因新增默认gathering=0未更新，已按新契约修正并通过最终23项。root接怪物/清波/领取收入和publicClone白名单；源gear.ts无publicClone函数，已告知root其域同步。无实际当前局操作、无本模块提交。
