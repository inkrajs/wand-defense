# 架构与接口 v0.1

单仓库 TypeScript + React + Vite；消费锁定版本 @inkra/react。
先使用 npm 单一 lockfile，所有依赖变更由根协调者处理。

## 分层与依赖
src/contracts：唯一公共类型（根协调者所有）。
src/content：静态定义、配方、序列与表现映射（战斗负责人协调，先落实 demo 数据）。
src/engine：纯战斗模拟，无 DOM/HTTP/React 依赖。
src/loadout：布局几何、装备与合成事务，无 UI/HTTP 依赖。
src/runtime：统一命令路由、订阅、暂停与奖励流程，组合 engine/loadout（根协调者）。
src/ui：React/Inkra，读取 RuntimePort、发语义命令；不重复游戏规则。
src/agent：浏览器到 HTTP broker 的出站连接与玩家可见投影。
server：HTTP broker；cli：Playlink CLI；skills/playlink：Agent 使用说明。
静态完整内容不应被 agent 的普通发现端点返回，协议投影须过滤。

## 公共约定
完整类型见 src/contracts/index.ts；mock 见 src/runtime/mock.ts。
GameState 为唯一权威状态，所有实体有独立实例 ID，定义 ID 与实例 ID 分开。
命令有唯一 id，返回 accepted/executed/rejected（accepted 不表示执行成功）。
事件有递增序号、游戏时钟和语义 type。RuntimePort 提供 getState/dispatch/subscribe；实际运行时另提供 subscribeEvents，向存档阶段监听和Agent缓冲发送轻量标量摘要与独立事件副本，避免复制无用的完整状态。该能力在公共端口中可选，旧适配器继续使用subscribe。
UI 和协议依赖 RuntimePort；mock 可用于并行开发，交付需明确是否已接真实运行时。
所有 snapshot 均不可由调用方修改来绕过 dispatch；最终运行时需做幂等与权限校验。
状态订阅与事件订阅共用有序通知队列；重入命令不会改变已排队的历史快照，各监听器不能相互修改事件或状态。
engine.stepBattle(state, dtMs, content) 返回新 state 和事件，不含奖励领取 UI。
loadout.applyLoadoutCommand(state, command, content) 返回 CommandResult 与 state/events。
布局变化提交后刷新编译施法效果；同一物品只能有一个位置，合成须先完整校验再原子提交。
公共接口变更写入任务记录并通知根协调者，不各自新建另一套类型。

## 可扩展要求
法术以 effect 类型+参数配置，预留新效果处理器；资产 key→表现映射可替换。
角色/法杖/法术/奥术的等级品级、序列条件用结构化数据保存。
保持简单明确的接口，围绕已规划的召唤、建筑、治疗、合成、多角色扩展。

