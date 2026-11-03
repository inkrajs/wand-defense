# 根运行时集成 Sol 审查

审查者：独立 GPT-6.1 Sol；日期：2026-11-03。仅拥有本记录，未修改代码或其他任务文件。
状态：根运行时集成 Sol 验收通过（代码与定向调用）；初审两项 P2 已按当前代码复核关闭。broker/connection 与最终 HTTP 闭环仍待独立验收。

## 范围与证据

实际阅读 AGENTS.md、demo-scope、architecture、development，以及 runtime/index.ts、mock.ts、main.tsx、AgentConnection.tsx、scripts/test.mjs；沿调用流检查 contracts、initial、loadout transactions、engine、content、UI 调用、agent projection/protocol 及模块任务记录。
审查过程中根协调者已把初始状态从 mock 提取至 runtime/initial.ts；已重新阅读最新实现。connection.ts 尚未落盘属于协议任务进行中，不作为本轮根逻辑缺陷。没有重复已有整套 smoke，没有视觉评审或截图。

实际定向执行：使用 node --import tsx 的内联脚本验证初始普通投影、手动暂停→开背包→关背包保留暂停、订阅重入事件顺序；均无写入源文件。没有宣称全仓 build/test 或浏览器历史恢复实际运行通过。

## 初审问题（均已关闭，修正证据见文末）

1. **[P2] 历史缓存恢复后运行时永久失效。** `src/main.tsx:11-12` 无条件在 pagehide 清计时器并 dispose；浏览器把页面放入 back/forward cache 时也会触发 pagehide。返回该缓存页面不会重新执行模块入口，而页面仍持有已 dispose 的 runtime，全部命令返回 DISPOSED 且没有计时器。建议 pagehide 按 persisted 区分暂停与最终销毁，并在 pageshow 恢复计时器；保留 HMR 真正 dispose。需对历史返回的恢复路径做一次定向验证。手机前台切换/历史访问属于本期同一游戏前台使用范围，不是要求后台战斗。

2. **[P2] 已知配方无法通过普通发现接口取得材料与邻接规则。** `src/runtime/initial.ts` 声明 recipeIds 含 fireball-recipe，但不含 fireball spellId；`src/agent/projection.ts:projectContent` 要求产物也已知才返回配方详情。因此普通初始 frame 实测 `recipeIds=["fireball-recipe"]`、`recipes=[]`，而人类 UI 直接从 catalog 取得配方名。Agent 必须事先猜测/硬编码材料，成功合成后才看见配方详情，破坏通用 HTTP 发现→构筑闭环。此项是跨模块知识契约问题，并非建议公布全图鉴：可为已知配方返回已知输入及邻接条件、隐藏未知产物定义，或在明确配方发现策略下仅发现其产物；交由根与协议负责人共同选择，更新投影隐私测试后复核。

## 可后续优化（当前消费者未触发，不阻塞现有 smoke）

- **[P2，已修正并复核关闭] 同步订阅重入会倒序通知事件。** 原实测监听器 A 收到 setBackpack 后同步 setPaused(true)，监听器 B 先收到 seq2 再收到 seq1。当前 `src/runtime/index.ts:20-37` 在提交时克隆 state/events 入队，notifying 阻止递归分发，当前批次全部监听器结束后再分发嵌套批次；每位监听器仍获取独立克隆，异常仍隔离。独立定向断言实测 B 依次收到 `{revision:1,eventSeqs:[1]}`、`{revision:2,eventSeqs:[2]}`；同时让 A 篡改参数 revision/seq，确认不影响 B 或权威 state。代码与调用验证通过，此项不再保留为后续待办。
- `results` 全局 Map 按命令 ID 永久保存，50ms 战斗期间状态事件则仅保留512条。无限波次/长连接使用会持续增长命令缓存；后续需要明确会话级幂等保留与过期语义，不能简单删缓存导致旧命令再次执行。
- `createGameRuntime(content)` 的初始实例、奖励列表与招募序列仍依赖 demo ID。对当前 demo 合法；若以后支持替换 catalog，宜一并注入初始配置和奖励策略，避免 missing definition 奖励不可领取。现在并非任意 catalog 可直接运行的通用工厂。

## 已通过的目标与调用流

- main 仅创建一个真实 runtime，React 与 AgentConnection 共享同一对象；mock 未接入交付入口。initial 独立后生产运行时不再依赖 fixture adapter。
- dispatch 统一路由：四种构筑命令复用 loadout 原子事务，其余由 runtime 处理；engine 复用 compileWand，UI/协议无第二套战斗模拟。
- snapshot、返回结果与每个监听器参数均 structuredClone；修改它们不会直接篡改权威 state。监听器异常隔离，不中断其他通知。
- 同命令 ID 在通知前写入结果缓存，重复成功/失败命令返回原结果；claim 清空全部候选并把 phase 置 ready，不同 ID 重复 claim 也无法再次领取；merge 输出由事务原子提交并发现产物。
- 背包打开强制暂停，拒绝直接取消暂停，tick 同时检查 phase/paused/backpackOpen；关闭背包恢复此前手动暂停状态，定向验证通过。
- 清波奖励在 engine 进入 reward 后统一生成，offered 项才加入已知物品；升级逐级发放配置内材料，招募创建双向一致的角色/法杖并发现序列与赠品；最多3角色、每角色2杖。
- cheats unlock 仅改变权限，不批量发现 catalog；远程命令白名单没有 unlockCheats，锁定或关闭时拒绝作弊。赠送单法术才发现该法术。
- scripts/test.mjs 递归找 src/server/cli 下 .test.ts，以 tsx + Node test 执行并传递失败退出码；没有测试时失败，未发现当前根测试入口阻塞。

## 验收边界

上述结论来自实际代码与定向调用，不能代替仍在开发的 broker/connection 的 Sol 验收和最终 HTTP 集成。根协调者已有完整 smoke 结果为上游提供信息，本记录未重复执行。界面效果仍由用户确认。

## 修正后复核

- 实读当前 main.tsx：已删除 pagehide 的永久 dispose，close 仅用于 HMR dispose。缓存页面不再经此入口销毁 runtime/计时器，原失效路径消除；本次为代码复核，未声称运行过浏览器历史恢复场景。
- 实读 runtime/index.ts、mock.ts、initial.ts：生产状态来自独立 initial，mock 仅复用该工厂，无生产依赖 mock。
- 同步发现协议负责人已修正 projectContent：已知配方返回已知输入、unknownInputCount 与邻接条件；未知产物 ID/定义不返回。内联断言实测初始 fireball-recipe 包含 spark/amplify、requireAdjacency=true，output 字段不存在，fireball 仍未成为已知法术；发现与隐私同时保持。
- 实际运行 `node --import tsx --test src/agent/projection.test.ts`：2/2 通过。
- 本轮不重复 engine/loadout/UI 模块验收；connection 未完成不算根 runtime 逻辑缺陷，也未把 HTTP 最终集成标为通过。订阅重入已专项复核关闭；缓存保留与配置注入保持后续优化项。其他验收结论保持不变。
