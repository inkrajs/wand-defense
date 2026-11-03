# 战斗与内容负责人

## 当前主线范围（用户试玩后调整）

用户决定先完成直接战斗与构筑闭环，建筑/召唤不合入当前版本。
当前 engine/content 已删除生成、友军推进及相关内容定义，保留
spark/fireball/regrowth/metal-needle、四奥术、火球配方和序列机制。
精简后负责人执行9项战斗检查并做 Sol 代码验收通过。
初始库存、奖励和新护盾结算由根协调者接入，并经独立 Sol 定向复核。

此前完整原型和后续自由位置部署已保存在
[feature/summons-buildings](https://github.com/inkrajs/wand-defense/tree/feature/summons-buildings)，
由负责人在独立 clone 拆分两项 Luna 任务实现并经 Sol 验收，未合并 main。
该分支是语义部署 API 原型，场景点选交互、碰撞/占地/寻路等尚未实现。
下方原始记录保留为开发历史，不代表当前主线启用了召唤与建筑。

状态：实现完成，已交根协调者集成。负责人 GPT-6.1 Sol。拥有 src/engine/**、src/content/**、本记录。

## 已派发的原生并行任务

| threadId | 模型/provider | 独占文件 | 当前进展 |
| --- | --- | --- | --- |
| 01a1a191-6b49-7351-898d-5d200fe06c9e | GPT-6 Luna / native | src/engine/waves.ts | 已完成，Sol实码复核通过 |
| 01a1a191-6ff3-7412-9f97-6dcd5479d318 | GPT-6 Luna / native | src/content/demo.ts、src/engine/effects.ts | 已完成，Sol实码复核和集成验证通过 |

负责人独占 src/engine/index.ts 及模块验证。共享checkout，无提交/依赖/公共契约修改。

## 集成约定

导出 demoContent: ContentCatalog；startBattle(state,content): Transition；stepBattle(state,dtMs,content): Transition。
内部步长最多50ms，场地坐标0..100，敌人从y=0向领地y=92推进。
暂停、背包打开、非battle阶段冻结游戏时钟。合法transition只增加一次revision，事件追加state.events。
击杀收益和清波由负责人集中结算；奖励选项及领取由根运行时负责。清波设phase=reward并发waveCleared。
法术使用构筑compileWand（最终接口已接通）。序列加成只在编译或适配一处应用。
内容稳定ID：spark/fireball/fire-spirit/regrowth/wolf/wood-spirit/metal-needle/arrow-tower/metal-spirit；
arcana amplify/double/split/focus；recipe fireball-recipe；sequence fire-9/wood-9/metal-9。

## 验收范围

实际代码、调用流程、目标/分层/复用/扩展性已由Sol审查，验证结果见下。无需AI视觉验收，界面由用户确认。

## 实现与调用流程

- `startBattle` 校验 ready/暂停/领地状态，深拷贝权威状态后调用 beginWave。
- `stepBattle` 深拷贝输入，按最多50ms分片推进，敌人→友军→编译法杖/共享角色法力施法→死亡与清波结算。传入50ms的整数倍可稳定复现；运行时应使用50ms固定时钟，任意小数分片不保证跨批次等价。
- `compileWand` 返回完整 SpellDefinition+itemId/copies，适配 id→definitionId/copies→casts，power/range/hp 已编译，战斗不再次叠序列。
- 事件：waveStarted、enemySpawned/bossSpawned、enemyAttacked、territoryAttacked、spawn/despawn、damage/heal、enemyKilled、playerLevelUp、waveCleared、defeat。事件seq单调递增并追加state.events，revision每有效入口一次。非battle/暂停入口不产生变更。
- enemyKilled 必得 xp=max(1,round(maxHp/8))；金币概率受luck影响。累计xp阈值 level*(level+1)*10。waveCleared发放保底5+wave*2金币并设reward，runtime不得再发保底；runtime负责选项、升级赠品及领取后ready。
- 每个来源法术同时最多2个召唤/建筑，满额不扣法力/不开冷却；双重按一次法力多次效果；友军独立hp/时限，木灵按已编译power每秒治疗。临时实体清波移除。

## 实际验证与Sol审查

已运行 `node_modules/.bin/tsx --test src/engine/index.test.ts`：13/13通过。
覆盖暂停和背包冻结、序列只加一次/输入不变、死亡与清波只结算一次、固定分片批次确定性、召唤和建筑真实攻击、领地治疗/失败优先、5/10/100 boss优先级/高波次成长、初始构筑自动清首波、双重击同一目标且只付费一次、召唤容量等待、多杖共享mana/独立冷却、木灵HP/治疗序列加成及自然到期不发敌人奖励。
另已运行全仓 `node_modules/.bin/tsc --noEmit`：通过（截至运行时的共享checkout）。不重复跑UI全套，不做AI视觉确认。

Sol已阅读waves.ts、demo.ts和effects.ts实际实现及调用流程，验收目标/层次/复用/扩展：
- 敌人模块仅生成移动攻击，清波和经济只在index统一结算，无DOM/HTTP/React依赖。
- 内容目录有全部scope首批火木金法术、四奥术、真实火球配方、途径序列及可替换asset key。
- 发现并要求执行者修正高波次hp/damage封顶、成长字段缺漏、忽略编译hp/range、木灵丢失编译power、double仅打不同目标、heal忽略copies等，修正代码经Sol复核和上述集成测试确认。
- 本期projectile为即时命中语义damage事件，不生成有飞行速度的弹道实体；split暂与double一样增加施放次数。木灵治疗行为依据根协调者新增的summonBehavior配置分派，不依赖固定ID；已用另一个sapling定义验证同逻辑复用。
- 未验证前十波数值平衡、完整100波游玩或视觉效果；最高boss和高波次公式通过定向验证，不等于平衡验收。

波次子任务已完成、Sol验收通过；内容效果子任务已完成，Sol验收通过；最后冷却状态已统一为实体攻击1000ms，与召唤施法冷却分开。没有provider故障或模型恢复事件。所有子任务均使用已确认可用native GPT-6 Luna，未使用Flash。

## 最终补充

依根协调者请求：序列名统一为执烛人/拾种人/修补匠；新增未加入初始知识的fire-8燃灯者(previousId fire-9)、加成及实时等级/法杖条件和消耗金币条件。不实现晋升命令。
13项测试新增任意新定义按summonBehavior复用治疗，运行通过。定向strict TS（--ignoreConfig --types node，入口engine/index.ts、index.test.ts、content/demo.ts）通过。最新全仓TS受到并行模块AgentConnection对agent/connection暂未生成的错误影响，已通知根。两个子任务最终状态已核验idle/completed，没有遗留工作。
