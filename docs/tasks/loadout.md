# 构筑负责人
状态：模块已实现并通过 Sol 验收，等待根运行时总集成。负责人 GPT-6.1 Sol；共享 checkout，仅拥有 src/loadout/** 和本记录。

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
构筑仅背包打开且暂停时可操作，defeat 禁止。配方精确多重集且材料在同杖；邻接配方要求材料图四边连通；先校验后原子消耗，产物进背包避免空间失败；失败原 state 不变。合成产物同步当前玩家知识。法杖重归属保持双向一致，每角色最多两杖。
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
