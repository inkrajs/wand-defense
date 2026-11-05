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

## 主线真实弹道修正（2026-11-03，完成并交接）

本节取代此前即时命中原型说明；召唤/建筑仍仅在隔离feature，不合入主线。
用户要求弹道实际接触后再伤害。根负责共享类型/协议/UI，其余UI及奖励仍并行修改，战斗只改engine与demo三个弹速。

| 原生threadId | 模型/provider | 独占文件 | 进展 |
| --- | --- | --- | --- |
| 01a1a1f0-d740-72c3-8f09-6cb3d55d342b | GPT-6 Luna/native | projectiles.ts、motion.ts、waves.ts | completed/idle；真实弹体与共享指数积分已落盘，Sol验收通过 |
| 01a1a1f0-db34-74a3-86dd-a80e9dc23b7c | GPT-6 Luna/native | projectiles.test.ts、motion.test.ts、index.test.ts | completed/idle；真实飞行与清波回满法力测试已落盘，Sol验收通过 |

负责人独占effects.ts/index.ts及本记录、demo.ts只spark/fireball/metal-needle的speed=72/50/100。
保留root现有敌人cap*.18入场、tau1200/boss1800、精确指数距离积分及旧存档缺失moveSpeed时满速语义；保留compileWand现有runBonuses.attackPercent加成。
执行顺序：advanceEnemies→defeat检查并清弹体→advanceProjectiles→settleDeaths→cast→settleDeaths/清波。新弹体不在同一50ms子步移动，发射成功才由既有逻辑扣一次法力并设置冷却。直接治疗不改。

Sol已按实际代码/调用链/扩展复用审查，结果见下。不进行AI视觉验收，不提交/推送。


### 实际实现与Sol验收

- castSpell验证现有物品/角色/法杖归属后调用spawnProjectiles，发射不改敌人HP。发射成功才沿用index扣mana/设置item冷却，双重/分裂生成各自独立实体；只扣一次触发资源。
- 每弹记录originX/Y、targetId、last targetX/Y、发射时已编译damage及5秒寿命。跟踪原活目标，抵达时才发damage并扣HP；原目标死亡后保持最后坐标飞行，不换目标也不伤害其他敌人；到点或超时退场。
- 火球以cap18%起步、tau600ms指数加速；spark/metal-needle恒速。敌人和火球均调用motion.integrateMotion，数学只一份；敌人原有cap18%/tau1200或boss1800及旧存档fallback保留。
- index按最多50ms子步先推进既有弹体，再施法；新弹体不会同一子步直接命中。settleDeaths集中结算死亡收益，清波/defeat清理在途弹体；暂停和背包冻结，无独立墙钟或UI计时器。
- 用户新增清波规则已完成：真实waveCleared分支在phase=reward前将全体角色mana=maxMana，包括未持杖角色；奖励tick不会再触发，defeat不补满。没有移到claim/start路径。
- 保留compileWand本局runBonuses.attackPercent和序列计算；弹体在发射时存储最终damage，命中不重算当前buff，避免叠两次或丢加成。
- 完整阅读了两执行者实际实现与测试，纠正多copy ID依赖emit递增的假设、无效旧弹体落点、测试错误假定发射无事件/底层推进自行移除，以及等待命中期间mana自然回复/两次transition revision的断言。双方最终状态均已核验completed/idle，无provider失败或模型恢复。

### 最终事件契约

- projectileSpawned：entityId、definitionId、sourceCharacterId、sourceItemId、targetId、x/y、originX/Y、targetX/Y，每弹一次。
- spellCast：sourceCharacterId、sourceItemId、definitionId、casts、targetId，每次触发一次。
- damage：projectileId、targetId、sourceCharacterId、sourceItemId、amount、effect、x/y，仅真实命中。
- projectileExpired：entityId、sourceCharacterId、sourceItemId、targetId、x/y、reason（timeout/targetLost/invalidPosition）；命中不重复发expired。

共享四个坐标字段及公开投影/白名单由根负责人新增；战斗没有改contracts/runtime/agent/ui。既有heal事件附x50/y84是接手前根已加的表现信息，保持原状。

### 实际验证

`node_modules/.bin/tsx --test src/engine/*.test.ts`：26/26通过（index11、projectiles9、motion4、既有movement2）。覆盖发射不瞬伤、原目标跟踪/死亡后不转移、有界寿命、多真实弹体、暂停/背包、敌人加速与积分批次等价、编译攻击加成快照、输入不变、死亡/清波仅一次、全角色清波回满、defeat不回满、清理在途实体和初始构筑自动清首波。
另运行`src/runtime/speed.test.ts`：2/2通过，核对既有速度/暂停统一模拟时间；未修改该文件。
全仓`tsc --noEmit`最终通过；本范围`git diff --check`通过。过程中曾有测试中间态never[]以及另一模块merge-items尚未落盘错误，均已在最终全仓类型核查中消失。不重复运行UI/其他模块整套。

### 当前限制

使用逻辑点位置跟踪并在50ms子步内按剩余距离截断到目标，未增加敌人/弹体尺寸碰撞、穿透、范围爆炸或两条运动轨迹的连续扫掠碰撞。发射起点仍为规则坐标50/84，UI渲染起点和表现由根对接；没有进行视觉验收。弹速及火球600ms起步仍为原型数值，未宣称平衡已确认。没有合入召唤/建筑feature，没有改依赖、提交或推送。完成后停止编辑交根统一集成。

## 品级增殖的弹体资源边界（2026-11-03，完成）

根协调者实读新增品级成长交叉规则后发现，四个神话double可产生7^4=2401 copies。此次为Sol负责人直接实现的小增量，无新增子任务，不是失败恢复；真实飞行/命中与运动数学均未回退。

`projectiles.ts` 导出命名原型配置 `PROJECTILE_LIMITS = { perCast: 64, alive: 512 }`：

- 所有角色/法杖共用同时存活弹体池；hp>0且未到期的projectile占容量（旧状态未给寿命时保守计入）。死亡/到期弹体不占容量。
- 每次实际发射数量为请求次数、64和剩余容量的最小值；剩余容量不足时只生成可容纳的实际数量，仍只扣一次触发法力并启动一次冷却。spellCast.casts与projectileSpawned次数均对应真实发射数量。
- 池满时spawnProjectiles返回false，既有index保持mana和该item冷却，待容量释放后自动施法可重试；没有排队超额弹体，也不把copies堆积到后续补发。
- 普通单发/双重在预算内行为不变。64/512为当前原型的模拟资源与施放上限，不是已确认的最终平衡数值。

Sol检查了容量计算→生成数量→事件→caller资源分支，追加两项有意义的边界验证：2401 copies单次截到64、池达到512不再创建且无事件、仅空两槽时实际casts=2、死亡/到期释放容量及ID唯一；真实stepBattle满池不扣mana/不开冷却，释放一槽后付一次资源并发一弹。
实际运行projectiles.test.ts + index.test.ts共22/22通过，含原有真实命中/暂停/清波/初始试玩回归。定向strict TypeScript检查与本范围diff-check通过；未重复跑全仓测试。修改仅projectiles.ts、projectiles.test.ts、index.test.ts和本记录，停止编辑交根统一集成。

## 新增四系攻击魔法（2026-11-03，完成交接）

用户希望正常流程中获得更多攻击魔法。本轮只扩充配置与正常物品奖励轮转，保持真实弹体/品级成长/本局增益结构；没有新增contracts字段、引擎分支或特殊状态系统，没有改UI、存档或初始库存，也不自动给玩家发物品。

| 原生threadId | 模型/provider | 独占文件 | 进展及Sol结论 |
| --- | --- | --- | --- |
| 01a1a208-6c0b-7f10-ba5f-d6d9efa3e6a3 | GPT-6 Luna/native | src/content/demo.ts、docs/design/content.md | completed/idle；四定义及当前原型表实读，Sol验收通过 |
| 01a1a208-7442-7423-b15a-c5fbbc4ee706 | GPT-6 Luna/native | src/content/rewards.ts、rewards.test.ts | completed/idle；轮转/既有奖励兼容实读，Sol验收通过 |

Sol负责人另拥有src/content/attack-spells.test.ts及本记录。没有provider失败、恢复或模型切换。

| 固定定义ID | 名称/属性 | power | mana | cooldown ms | range | speed世界单位/秒 | footprint |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| water-bolt | 水弹/水 | 8 | 3 | 600 | 26 | 60 | 竖向2格 |
| lightning-bolt | 雷矢/雷 | 22 | 9 | 1300 | 36 | 140 | L形3格 |
| wind-blade | 风刃/风 | 6 | 2 | 350 | 22 | 110 | 横向2格 |
| rock-shot | 岩弹/土 | 36 | 12 | 1800 | 30 | 34 | 方形4格 |

均为level1/common的单目标projectile。水弹偏低耗稳定，雷矢远程高速，风刃快冷却低耗，岩弹慢速高单发/更大占格。数值仍属原型，未宣称平衡确认。全部能装3×3；现有火花、火球、金针、回春、四奥术、配方和序列保持。风刃未增加单次多发字段，其节奏差异由冷却实现。没有声称实现水减速/潮湿、雷连锁、风穿透或岩范围爆炸。

createWaveRewards正常物品候选的十波轮转为：水弹→风刃→雷矢→岩弹→增幅→双重→金针→回春→分裂→聚焦，11波从水弹重复。前四波每波可选一项新魔法，选择其他奖励不自动补发。buff品级推进、治疗/角色/法杖/金币及RewardOption接口保持兼容；当前checkpoint里已经存在的奖励不被重抽。新目录条目仍由既有知识/奖励发现规则披露，不一次解锁图鉴。

调用链复用：demo定义→正常reward item→既有领取逻辑→背包→既有法杖放置/旋转→compileWand品级/序列/本局增幅→spawnProjectiles→真实飞行接触伤害。没有为四个ID写新专用战斗逻辑，继续使用单次64/同时512上限。

Sol已阅读两子任务实际代码与调用说明，检查配置类型/数值/形状、奖励兼容与扩展复用；要求奖励测试移除完整字段集合相等断言，改核对必需字段与占格详情，允许后续增加可选元数据。未做视觉验收，四种视觉形状和命中效果由根/UI负责。

实际验证：attack-spells.test.ts 4项真实remove旧法术→place新法术→3×3编译→发射扣费/冷却且不瞬伤→按速度飞行→命中一次；rewards.test.ts 3项覆盖前4波、十波循环与非item候选/品级兼容；既有runtime/rewards.test.ts 3项验证领取去向、buff、刷新等兼容，合计10/10通过。奖励测试最后按Sol意见调整断言后，子任务再跑3/3通过。定向strict TypeScript及范围diff-check通过；没有重复跑全仓测试。当前存档没有修改或重置，不提交/推送。完成后停止编辑交根统一集成。

## 真实死亡元数据与敌人等级品级（2026-11-03，完成）

本次由Sol负责人直接完成小域增量，无新委派任务。根负责CombatEntity可选level/grade字段、BloodDecals表现及公开投影，战斗仅修改engine/index.ts、waves.ts、新death-metadata.test.ts和本记录。

spawnEnemy增加展示用等级/品级：level取当前wave且至少1；普通common、小boss rare、大boss epic、顶级boss mythic。这是临时分级配置，仅加元数据，不参与HP/伤害/速度/掉落或随机计算。

enemyKilled保留entityId/definitionId/xp/coins，并在删除实体前附x、y、maxHp、level、grade、wave。旧实体缺level时用当前wave（至少1），缺grade时用common；不会根据最近施法猜来源。

transition内创建临时pendingKills映射：真正的damage事件在HP扣除后发出，只有目标为enemy且已经到0、amount>0才记录该次effect/sourceItemId/sourceCharacterId；紧接的settleDeaths取出并清理。多弹体顺序命中时非致死命中不会成为击杀来源，目标死后后续弹体不会再发damage。来源字段仅拷贝实际致死damage已提供的字符串，没有来源时字段直接省略。映射不写入GameState，不扫描历史state.events，不跨transition残留；没有引入第二套伤害判定。

Sol实码检查：伤害时点、emit次数与seq、死亡收益公式、LCG调用次数、清波和法力恢复均保持；没有修改projectiles命中逻辑、UI或战斗平衡。非玩家来源或legacy预死实体仍产生无伪造effect/source的死亡事件。

实际运行death-metadata.test.ts 5项（spark/rock-shot真实致死来源各1、多来源同一步唯一killer、legacy预死默认/不继承历史damage与LCG一次、普通/三档boss等级品级且LCG无新增）和既有index.test.ts 12项，共17/17通过。定向strict TypeScript及范围diff-check通过，未重复全仓。血迹浓度/停留/风格由根按事件元数据决定；未实现所谓盐弹，仍使用既有rock-shot岩弹。完成后停止编辑交根统一集成，不提交推送。

## 角色独立经验与等级（2026-11-04，完成）

用户确认每角色独立累计xp/level/经验环。本节取代此前全队xp升级规则；state.xp仅保留全队累计击杀经验统计，state.playerLevel仅首角色level兼容alias，不再驱动共享升级。小域更改由Sol负责人直接实现，无新子任务，无模型失败恢复。

### 引擎经验归属

settleDeaths使用本transition真实致死pending cause.sourceCharacterId匹配当前仍在队伍的合法角色；只有该角色获得本次敌人xp。同一角色所有法杖均归该角色，飞行弹体使用发射时保存的sourceCharacterId，之后更换法杖持有者不转移已发弹体经验。无来源、已移除角色来源、legacy预死实体不会把经验塞给当前选择/当前持杖角色或其他角色。

enemyKilled保留所有血迹/掉落元数据及xp/coins，只有实际受益角色时附xpCharacterId。每个角色的累计xp逐级对照既有experienceThreshold曲线；跨多级时逐级发characterLevelUp {characterId,level,previousLevel}，不再发playerLevelUp。事件在该次死亡统一结算中产生，runtime可按每条个人升级事件发原每级赠品。没有修改伤害时点、弹体、金币概率、LCG调用、清波奖励或回满法力。

### 迁移API与边界

src/content/progression.ts导出normalizeCharacterProgression(state: GameState): void，原地归一化，runtimeconstructor由根调用。只迁移xp===undefined的角色：

- 首角色继承max(旧state.xp,自身旧level的累计下限)；有限负旧xp按0处理，旧level至少1。
- 其他缺xp角色只继承自身已有level累计下限，不复制共享池；新一级角色为0。
- 用累计曲线逆函数直接上推迁移角色level，不回放历史升级事件或赠品。已有xp角色保留其xp/level，不重新承接共享数据。
- 最后刷新首角色playerLevel兼容alias，不改state.xp统计。不写事件/rewards，重复调用不再迁移。

引擎以runtime已归一化的个人状态为输入；不在每次step重新执行旧共享池迁移。CharacterInstance.xp可选字段、new/recruit xp=0、runtime个人升级赠品、存档迁移调用、公开投影和UI经验环均由根/界面负责人对接，本模块未改这些文件，也未改用户当前存档。

### 实际验证与Sol检查

新character-progression.test.ts 4项：双角色不同击杀各获20/60累计xp并逐级升至2/3；同角色两杖真实发射后整体转交，经验仍归发射角色；无owner/已移除owner不分配个人经验且大额共享统计不触发升级；暂停/背包冻结经验与事件。
新progression-migration.test.ts 3项：首角色一次承接旧共享xp、其他角色只取等级下限、已有个人池不被复制；迁移重入幂等且无事件/奖励；旧等级下限及20/60/120等阈值边界。既有death metadata精确断言仅补实际xpCharacterId。

已运行上述7项+既有death5/index12，共24/24通过。定向strict TypeScript与范围diff-check通过，未重复全仓或验收UI。Sol实读经验受益Set、逐级事件、发射来源追踪、无owner路径与迁移调用边界，确认只有个人累计值驱动角色level，不以兼容统计凑等级。没有提交/推送，停止编辑交根统一集成。

## 十五种可玩法术与通用影响机制（2026-11-04，完成）

用户要求再增加12种魔法，随后追加3种持续射线。本轮保留原8定义，demoContent共23 spells；15个固定新增ID为flame-lance/cinder-burst/thorn-shot/renewal/tidal-orb/stone-spike/iron-disc/gale-burst/arc-chain/light-arrow/dark-orb/ward/solar-ray/ember-ray/void-ray。完整参数/形状见design/content.md当前原型表与demo.ts，均level1/common、实际可装3×3，不是只写能力文案。

### 原生并行与文件边界

| threadId | 模型/provider | 独占文件 | 状态及Sol验收 |
| --- | --- | --- | --- |
| 01a1a22f-e838-7703-a5f5-63ec59275bc4 | GPT-6 Luna/native | content/demo.ts、rewards.ts、rewards.test.ts、design/content.md | completed/idle，实际数据/轮转/配置文档经Sol通过 |
| 01a1a22f-eb63-7942-b93a-cb1447c69336 | GPT-6 Luna/native | engine/impact.test.ts、content/expanded-spells.test.ts | completed/idle，关键行为与真实事务/战斗测试经Sol通过 |

Sol负责人实现engine/impact.ts、targets.ts、beams.ts及projectiles/effects/index集成，并完成随后waveProgress/waves小域扩展；没有再拆第三任务。根负责contracts类型、loadout编译beam攻击加成及配置克隆、所有UI/agent/runtime、当前run onlyMissing补全库存；本模块不修改这些文件或用户存档，不自动装备、不提交/推送。没有provider失败/恢复。

### 真实机制

- targets.ts提供稳定距离/ID顺序选择和统一接触伤害。各模式damage都在模拟中真实接触/脉冲时发，保留发射sourceCharacterId/sourceItemId/effect，现pendingKills对每个真正致死目标独立关联个人XP/血迹来源，不按UI猜。
- ProjectileImpact为根冻结的discriminated union。pierce接触后沿入射方向向前、距射线不超过4单位、后续射程内选未命中活敌人，继续同一弹体实际飞行；chain接触后取配置半径内未命中活敌人，当前伤害按falloff逐段衰减，下一50ms子步继续飞行。每段更新origin/target坐标，source不变。不会在同一接触子步凭空扣下一目标HP。
- splash只在首目标实际接触时，以接触点为中心按radius/距离/ID选择有限活目标逐个结算；原目标中途死亡仍只飞至记忆位置消散，不提前触发范围伤害。hitIds去重，三模式每个弹体总目标<=8，remainingImpacts记录余额；延续段不重置原5秒寿命，不另造无限后继弹体，保留每触发64/同时512弹预算。
- ward为shield恢复，最多补到territory.maxShield；满盾、无有效上限或无效恢复不扣mana/不开冷却。shieldRestored包含effect/amount/x50/y84/targetId territory及来源，事件名按根约定。renewal沿用真实治疗。
- 三射线effect beam有BeamSpec配置，实体固定从50/84向最初所选敌人方向延伸到最大射程，不追踪目标；width/2点到线段距离判定，每次pulse稳定选择<=8个活目标。power代表每pulse伤害，非整个持续期总伤害。
- beam首次pulse至少100ms，后续以模拟dt推进cooldown/attackRemaining/remaining；无UI时钟。solar每100ms/900ms，ember每200ms/1200ms，void每400ms/1000ms；global活beam<=24，总寿命<=5000ms。满池返回false不扣mana/不开冷却，部分空槽只发实际数量，spellCast.casts为实际数。
- index先推进既有projectiles和beams，再结算死亡/施法，新beam不在发射子步脉冲。暂停/背包/速度沿统一dt；清波清全部实体，defeat明确移除两种在途实体。既有个人XP/金币/RNG/清波回满规则保持。
- 事件新增beamSpawned（entityId/definitionId/source/x/y/targetX/Y/beamWidth/remainingMs），damage在beam时带beamId、普通弹体带projectileId；spellCast、projectileSpawned/Expired、enemyKilled等仍沿既有语义。根已接射线与其他15法术表现。

normal item奖励保留旧前10项，再依次附15新ID，共25项轮转。没有重抽现有存档奖励；根仅补当前run尚未拥有的定义到背包并解锁知识，不在本模块执行该操作。

### Sol实际审查和验证

审查了内容执行者全部15定义/奖励轮转和测试执行者实际调用链，检查effect参数、形状、真实发射→接触、资源边界与分层扩展。Sol自行抽通用选敌/伤害，修正pierce入射方向不得按两个分量分别fallback，避免混合方向；补beam无效脉冲间隔防零延迟循环。要求护盾测试保留远处敌人，避免清波自动回满mana掩盖扣费错误；要求amount unknown收窄、三模式预算、真实范围多杀归属及beam池上限/冻结/清场验证，均已完成。

实际运行：新impact.test.ts + expanded-spells.test.ts + rewards.test.ts共20/20通过（机制/内容占格/伤害/支持法术资源/25波轮转）。另旧projectiles/character-progression/death-metadata/rewards回归22/22通过；没有重复全仓。定向strict TypeScript及范围diff-check通过。根负责全网站补齐库存、视觉验收与最终统一集成，本记录不声称这些外部步骤已完成。

### 限制与原型选择

穿透为前向窄带内逐目标引导飞行，不是物理碰撞器的连续扫掠；chain复用原实体而非创建独立新弹体，仍有真实后继飞行。范围伤害即时发生在真实首接触点；射线为固定线段脉冲，可以走出线段。宽度/半径/衰减/目标数/伤害和射速都是原型数值，未宣称平衡确认。未实现其他状态系统或召唤建筑，未操作当前存档或做AI视觉验收。

## 波次Boss节点与进度（2026-11-04，完成）

用户追加右侧进度与中途/结尾Boss节点。本段由Sol负责人直接实现，无新子任务。

WaveSpec新增bossNodes数组{id,spawnIndex,tier}，spawnIndex为0起点；getWaveSpec和spawnEnemy共用该表，禁止UI画虚假节点。每5波末尾minor；每10波（100优先）中途minor、末尾major；每100波中途major、末尾apex。中途索引floor(count/2)，末尾count-1；bossTier仍为末尾Boss层级兼容信息。中途Boss实际替换该次普通敌人，数量不增，生成/掉落随机调用次数不额外增加；该节点编排为临时试玩配置，确实改变中途敌人强度。

新纯API `import { getWaveProgress } from '../engine/waveProgress'` 返回{total,defeated,progress,markers:[{id,position,tier,cleared}]}。正常进度为(total-waveSpawnRemaining-aliveEnemies)/total并截断，wave0为0/空节点，reward显示上一波1；position=spawnIndex/total。cleared需该索引已经生成且对应enemy-wave-(total-index)不再存活；不通过progress跨过position推测，所以乱序击杀不会误点亮仍活Boss。

新waveProgress.test.ts 3项验证1/5/10/100实际逐个spawn与节点完全一致、marker position、乱序击杀、尚未生成/ready0/reward边界；连同既有movement2与death5检查共10/10通过。随后定向strict TypeScript及范围diff-check通过，不改UI；helper已交根/UIlead消费。全部本轮文件停止编辑，等待根统一提交。

### 最新奖励规则覆盖（2026-11-04）

用户随后明确要求每张奖励独立随机，允许全攻击/全其他属性/混合，固定轮转不符合最终需求。上文25项固定物品轮转仅是此前中间实现与当时验证记录，不能作为当前最终规则或验收结论。root已接手content/rewards.ts、rewards.test.ts及runtime RNG/领取/增益共享数据；内容子任务已completed/idle，相关文件立即释放，本负责人不继续修改或扩固定列表。15种法术定义及真实影响/射线/护盾机制保留，所有新法术正常奖励的可得性由root的随机池实现与新测试最终确认。

本模块完成并交接的范围仍是15法术真实玩法、实际3×3放置、通用有界影响与持续射线，以及真实Boss节点/进度。未宣称随机奖励、用户当前save补齐和UI验收已由本模块完成。

## 波次遭遇序列取代固定中/末双节点（2026-11-04，完成）

用户进一步澄清波次可由多段小怪与多个Boss段组成，不应固定两轮。此节取代上文固定mid/end示例；Sol负责人只改waves.ts、waveProgress.ts、waveProgress.test.ts及本记录，技能机制与已释放随机奖励文件完全未碰，没有新子任务。

WaveSpec现新增encounters: WaveEncounter[]，有序union为{type:'minions',count}或{type:'boss',tier:Exclude<BossTier,'none'>,count}。导出buildWaveSpec(wave,encounters)作为配置展平器，过滤无效数量、按60总敌人预算截断，生成同一实际count和每个Boss实例的bossNodes。一个boss段可有多只Boss，并各有独立spawnIndex/node；不是单纯画分段标签。getWaveSpec(wave)是当前权威配置入口，默认确定配置也经buildWaveSpec展平；spawnEnemy与getWaveProgress继续只消费这一份结果。UI不可独立传另一套配置猜节点。

默认临时配置：保留原count=min(60,5+(wave-1)*2)，因此第8波仍为19，不重置当前战斗；按强度拆多个minion/boss段。第5/10/20/100/200波分别有1/2/3/11/12只Boss，里程碑波最多12只且末Boss仍遵守5 minor/10 major/100 apex优先级。部分非里程碑波（12波起、4的倍数）有中途minor段后接minion，更多后期普通波可有多个中断Boss段。普通波也拆不同数量的小怪段，阶段总数量始终受60预算约束。bossTier表示最后实体属于Boss时的层级；普通波可能有中途Boss但bossTier仍none，真正完整信息以encounters/bossNodes为准。这些编排仍为原型平衡，不是随机地图。

getWaveProgress接口和UI现有markers字段不变。剩余计数继续clamp到0..total，非有限值保守视为尚未生成；即使旧checkpoint.waveSpawnRemaining大于当前total也不会负进度或把未spawn Boss标为清除。marker仍依据实际spawn索引映射的实例ID和存活状态，保留乱序击杀语义。

验证：waveProgress现6项，覆盖手工多Boss连续段展平/预算截断、1/5/10/12/20/100/200逐个真实spawn与所有nodes完全一致、1..250波总数量/独立节点一致、普通波混合、乱序击杀、legacy第8波与超大剩余计数/ready/reward边界。连同既有movement2及death5共13/13通过；定向strict TypeScript与范围diff-check通过。不重复全仓、不改用户save、不提交推送，完成后停止编辑。

## 角色基础属性、装备分层及真实施法（2026-11-04，完成）

用户确认角色先有固有属性，装备提升角色能力，再叠加法术与其他修饰。方案/字段/公式已先经根确认；根将contracts/content角色helper/initial/compile/engine/runtime核心文件本轮交本模块独占，UI和agent投影仍由根/界面负责。没有操作用户当前存档文件，没有依赖变更/视觉验收/提交推送。

### 原生委派与验收

| threadId | 模型/provider | 独占文件 | 已核验结果 |
| --- | --- | --- | --- |
| 01a1a240-1411-7642-8951-44f5de00abbc | GPT-6 Luna/native | content/characters.ts、characters.test.ts | completed/idle；helper、来源聚合、迁移、有限边界经Sol实际审查通过 |
| 01a1a240-16cd-7392-be82-9400fc3c5fec | GPT-6 Luna/native | loadout/compile.ts、actor-stats.test.ts | completed/idle；品质/角色/装备/奥术/序列/本局公式及快照经Sol实际审查通过 |

Sol负责人持有contracts、runtime/index/initial及runtime actor tests、engine接触/RNG/实体/回蓝/实际命中测试和本记录。两任务健康完成，无provider失败/模型恢复。曾因负责人先写消费者import、helper未落盘造成预览缺模块；已纠正顺序优先落完整helper，实际curl5173该模块200，未使用假stub。后续所有最终核心定向类型检查通过。

### 公共类型与真实来源

CharacterBaseStats字段/中性默认/单位：attack=0（额外攻击点，仅攻击法术）、castSpeedPercent=0（施法频率百分比加成）、range=0（世界单位射程加值）、accuracy=1（0..1命中概率）、critChance=0（0..1条件暴击率）、critMultiplier=1.5（暴击倍率）、luck=0（掉币概率百分点）、elementBonuses={}（系别比例加成）。mana/maxMana/manaRegen继续用既有实例字段，分别为当前法力/已有个人上限/每秒回复，没有在baseStats另造一份真源。

CharacterInstance.baseStats可选仅为旧checkpoint兼容，new/recruit使用createCharacterBaseStats每次独立创建。WandInstance.statBonuses支持Partial<CharacterBaseStats>及maxMana/manaRegen增量；可选state.gear注册表与角色gearIds提供head/body/feet/accessory四槽通用入口。装备不会永久写入base：只算wand.characterId和角色wandIds双向一致的法杖、每ID一次；gear需注册表id、slot、characterId和角色对应槽一致，去重。没有新增大型装备内容、gear背包或gear穿脱命令；现有法杖装备/卸下/换人是真实可操作链。

### getter与公式（界面/公开投影复用）

`getCharacterStats(state,characterId,content=demoContent): CharacterStatsView | undefined` 导出于content/characters.ts，未知或重复角色ID不返回伪结果。返回严格显式克隆的{base,equipment,run,sequence,final}，仅合法Element键，不spread未知payload。

final含attack/attackMultiplier、range/rangeMultiplier、castSpeedPercent/cooldownMultiplier、accuracy/critChance/critMultiplier、luck/totalLuck、elementBonuses、mana/maxMana/manaRegen。

- 原始角色平攻A=max(0,base.attack+equipment.attack)，M=max(0,1+run.attackPercent/100)，final.attack=A*M、attackMultiplier=M。
- 攻击法术基础power=(definition.power*物品品级倍率+ A)*M，再乘邻接奥术power倍率及最终系别倍率。编译等价写为spellGradePower*final.attackMultiplier+final.attack，避免平攻双乘。本局攻击增幅不增强heal/shield。
- 原始角色射程加值R=max(0,base.range+equipment.range)，N=max(0,1+run.rangePercent/100)，编译射程=(definition.range+R)*N，再乘focus邻接射程倍率。
- 施法频率S=clamp(base.castSpeedPercent+equipment.castSpeedPercent,-90,10000)，冷却=definition.cooldownMs/(1+S/100)*(1-clamp(run.cooldownPercent,0,70)/100)。引擎仍有50ms最小实际冷却，不把UI帧率当施法频率。
- 系别基础与装备比例先相加B=base.elementBonuses+equipment.elementBonuses，再与序列Q相乘：(1+max(-1,B))*(1+max(-1,Q))；final.elementBonuses存倍率减1，compile只应用一次。品质与各奥术原有规则保留，impact/beam配置独立clone。
- final.accuracy/critChance分别加装备后限0..1；critMultiplier限1..10；luck加装备后非负，totalLuck再合state.luck。幸运只影响实际金币掉落概率，未声称影响稀有物品概率。
- final.maxMana=已有character.maxMana+equipment.maxMana，final.manaRegen同理；已有实例字段已包含先前实际发过的本局maxMana/regen奖励，所以不再次加run摘要。发动/回蓝/清波回满使用同一getter；真实构筑/卸杖成功后按最终上限夹当前mana，装备去掉后不会遗留虚高容量或永久污染base。

基础合法有限值迁移保留；装备/本局计算层采用命名有限界限（flat ±1e6、倍率0..1e4、频率等边界），极大有限求和和相乘正向溢出饱和，不把溢出的法力上限归零。final.luck也与实际命中快照一致限1e6；公开层字段均有限。基础合法有限值可继续保留其原始数值，参与最终计算时有界，避免修改已有角色合法基础数据。

### 精准、暴击、幸运实际生效

CompiledSpell.attackRoll与CombatEntity.attackRoll快照{accuracy,critChance,critMultiplier,sourceLuck}。真实发射复制，换人/卸装/基础值改变不改变在途弹体或射线归属/概率。legacy无快照按1/0/1.5/0。

通用applyContactDamage由projectile/pierce/splash/chain和beam每次实际接触或pulse目标共用；使用同一个state.rngState的LCG保存流。非中性配置每次有效接触只取一个roll：roll>=accuracy为miss；命中时以roll/accuracy<critChance判暴击，保持P(hit)=accuracy及P(crit|hit)=critChance，准确处理0/1边界。neutral accuracy1/crit0不额外取随机数，保默认平衡与原掉落流。

miss仅emit attackMiss（entityId/targetId/source/effect/x/y），不emit damage、不扣HP、不发死亡/XP/血迹或清洗事件；该目标仍计已接触，穿透/连锁不重试同目标。beam每pulse每目标重新判一次。命中damage带critical与sourceLuck，暴击乘快照倍率；真实致死pending cause携sourceLuck，掉币保持旧概率clamp(.25+(state.luck+sourceLuck)*.01,.1,.8)，只取实际致死来源，非最近施法。极端伤害运算用COMBAT_ROLL_LIMITS.maxDamage=1e12防非有限，普通数值不受影响。

### 迁移/运行时及实际检查

normalizeCharacterStats(state):void逐field补缺/校验partial或malformed base，保所有有效值，不改身份、xp/level、mana、已有maxMana/regen。constructor调用一次，checkpoint仍v1；new/recruit独立clone中性base，不复制其他角色属性。重新归一幂等，没有自动升级/赠品或重置用户状态。

Sol实读两任务和集成，修正getter未定义安全分支、极大有限属性加法/乘法溢出、final.luck与真实快照限额不一致，以及不应在无关领地升级命令顺带夹角色mana的接线。公开projection和UI字段已通知根及UIlead，本模块不写其文件。

最终集中47/47通过：helper5、角色编译4、实际actor combat7、runtime actor3、既有compile7/impact13/death5/rewards3。覆盖基础/装备/品级/奥术/序列/本局不双算、真实射程与350ms施法、攻击接触伤害、单roll确定序列crit/hit/miss、中性RNG兼容、miss无死亡/XP、beam共用、发射快照、角色幸运真实掉币、装备法力回蓝及回满、真实卸杖容量回落、legacy不重置和新角色独立值。定向strict TypeScript及范围diff-check通过；不重复全仓，曾读到的UI/投影中间态错误交各owner修，根统一完整构建。全部核心文件已释放，停止编辑交根静态批审/统一提交。

## 雷系连锁小扩展（2026-11-04，完成）

按用户要求复用原内容Luna原生任务01a1a22f-e838-7703-a5f5-63ec59275bc4继续执行，没有创建新聊天、没有重写通用chain或重跑核心47/194。执行者仅追加demo.ts定义、expanded-spells.test.ts内容检查和design/content.md新段；读取最新文档后append，保留根已补的角色基础/装备说明。

新固定ID及原型：spark-hop跳电（8力量/4法力/650ms/射程26/弹速125，3目标、半径9、逐跳0.6，横2格）；thunder-chain雷链（20/14/1800/36/105，4目标、半径22、0.85，T4格）；storm-net雷网（12/16/2100/30/110，6目标、半径11、0.8，方4格）。均lightning/projectile/chain、level1/common；旧arc-chain及原23法术保留，目录现26。数值为原型，未宣称平衡定案。未添加可选暗系，保持小范围。

Sol实读3条配置、测试调用与文档：均<=3×3、参数有限、目标数不超现有8预算、真实后续飞行/去重/衰减沿用通用机制。修正雷链shape表误写L为T；补20单位跳距验证雷链独有的长跳距，保留10单位场景区分跳电与雷网。

实际expanded-spells.test.ts定向6/6通过，涵盖全部新定义真实放置/编译/首次发射不瞬伤以及3/4/6唯一目标、逐跳伤害和半径差异；执行者最后小修后重跑该文件仍6/6，未扩大至核心全套。最终定向strict TypeScript和本范围diff-check通过。执行者最终状态completed/idle，Sol验收通过，停止编辑。root负责新ID视觉映射及已授权当前run定向onlyMissing补齐，本模块未触用户IAB/runtime/preview/save，也不宣称用户已领取。无提交推送。

## 独立飞弹速度属性（2026-11-04，完成）

用户确认飞弹飞行速度独立于施法攻速，可由角色与装备提升后叠加法术speed。本轮仅该字段，无回旋/返回法术新机制，不重新叠mana/regen，不改全局时间倍率。

复用原健康Luna任务：01a1a240-1411-7642-8951-44f5de00abbc独占characters.ts/characters.test.ts；01a1a240-16cd-7392-be82-9400fc3c5fec独占compile.ts/actor-stats.test.ts；均已核验completed/idle。Sol负责人修改contracts可选字段、CastSpec与effects取编译速度、新engine/projectile-speed.test.ts并实读验收，无新聊天或失败恢复。

CharacterBaseStats.projectileSpeedPercent?:number仅因legacy/旧手写fixture兼容而可缺；factory及normalize补0，非法/非finite/越界base恢复默认。NormalizedCharacterBaseStats与getter.base/equipment均始终有number；final新增projectileSpeedPercent与projectileSpeedMultiplier。角色和合法装备同字段按百分点加法，最终percent限[-90,10000]，multiplier=1+percent/100，确保有限正值（约0.1..101）。装备归属/去重/白名单与其他属性一致，不永久写base，旧有效角色数据和mana/regen保持。

只对effect projectile编译speed=(definition.speed??72)*final.projectileSpeedMultiplier，缺速度的旧法术仍按原72基准享加成。CastSpec.speed可选，effects改取spec.speed??rawDefinition.speed??72，防原始定义覆盖编译值。真实实体speed和moveSpeed因此同时生效；火球仍以18%上限速度起步/原600ms指数时间常数，不复制积分。beam固定方向/脉冲、heal/shield不受飞弹加成，castSpeedPercent仍只调整施法冷却。游戏速度仍由runtime统一dt一次，不在编译或飞行另乘state.speed。

已通知root和UIlead准确字段及百分比单位。实测characters5+compile actor6+新projectile-speed3共14/14通过；包含旧缺字段/partial/非法默认、基础与wand/gear叠加/错误owner、有限边界、与攻速/法力独立、缺定义speed fallback、火花同20单位飞行300ms→150ms且冷却700/耗蓝4不变、火球cap50→100/起步9→18、solar-ray首pulse延迟100ms不变。最终定向strict TypeScript与范围diff-check通过；未跑核心47/194/全仓，没有改存档/IAB或提交推送。Sol实际代码验收通过，停止编辑并释放本轮核心文件。
## 角色成长、升级满蓝与两种敌人路线（2026-11-04）

根确认接口后复用两个健康原任务：Luna `01a1a240-1411-7642-8951-44f5de00abbc` 独占 characterGrowth.ts、character-growth.test.ts、characters.ts、characters.test.ts；Luna `01a1a240-16cd-7392-be82-9400fc3c5fec` 独占 waves.ts、waves.test.ts、characterAnchors.ts、character-anchors.test.ts。两个任务均实际完成并释放，未更换用户模型。Sol负责 contracts 初始字段、engine/index.ts 升级回蓝、growth-and-anchors.test.ts、文档与实际代码验收；projectiles/beams 的同源发射位置修改落后已明确交根独占继续双重/分裂新需求，不并写其文件。

CharacterInstance.growthProfileId 可选兼容旧档。getCharacterGrowth 返回 detached 的 profileId/name/multipliers/perLevel/total，基础每级 attack1/castSpeedPercent1/range0.1/projectileSpeedPercent0.5/maxMana5/manaRegen0.25；fire attack×2/cast×1.5，wood maxMana×2/regen×2/attack×0.75，balanced各1。总量为(level-1)×每级增量，各项有限封顶1e6，非指数翻倍；缺失/未知profile按wood/fire序列回退，否则balanced，normalize只保存档案、不改永久base/XP/mana。getter新增growth总量，base+growth+equipment后按原run/sequence规则合成，实例maxMana/regen已含run历史奖励，不重加摘要。settleDeaths每次真实level++后用传入content的最终maxMana回满，再发原逐级characterLevelUp；旧高等级恢复只计算成长，不补满蓝/历史赠品。

getCharacterAnchors(characters) 返回 {characterId,x,y}[]，x=50+(index-(count-1)/2)×min(24,80/max(1,count-1))、y84；三人26/50/74，单人50。UI头像、实际projectile原点与选敌射程、beam原点与真实线段及敌人追击共用此x来源，UI纵向仍投影至盾条上方，不宣称独立角色HP。CombatEntity.movementMode 为 straight/huntCharacter，targetCharacterId保存目标；spawnIndex奇偶定路线，同一既有出生随机值选角色，不新增RNG draw。straight与缺mode旧敌保当前x下行；hunter先到所选角色锚点84，再沿该x下行到92攻击共享领地。目标消失稳定取首个剩余角色，0角色退straight，不强制追空中心。暂停、背包、原integrateMotion/ramp及boss出生计划保留。

定向检查发现首波边缘straight无法进入初始火花射程，真实破坏原自动清波闭环；根确认仅首波x收至30+40×原random，后续仍10+80×random，不改火花射程或让直行怪归中。Sol强化首波用例，确认实际生成全部敌人而非反复读取首个旧敌，并再推进1000ms断言直行x保持。

已实际验证成长helper+stats10项、路线+锚点11项、真实成长/多角色发射集成4项，以及既有actor compile/runtime/combat16项通过。个人升级、旧档迁移、boss进度等检查通过；首波调整前明确有一次starter清波失败，未篡改测试预期。根双重/分裂核心稳定后，重新集中验证index+成长/发射集成16项中15项通过，确认首波自动清波恢复、成长/锚点4项保持通过；唯一失败为旧double测试期待100ms同时两次命中，现新120ms连发机制只命中一次，已交根cast所有者更新真实分时验证。本域不篡改或接管根cast测试。已通知根及UIlead完整API；无本域存档/IAB操作、提交推送或UI视觉验收。

### 法力来源复审修正

UIlead复审发现新增resourceSources对不一致旧档直接执行实例值减run摘要，会把maxMana20/run30反推为虚假基础-10（regen2/run4同理）。Sol已窄修characters.ts/test：character/run资源字段改为number|null，新增combined保存实例内合并数值、status按maxMana/manaRegen分别标derived或combined；无法非负可靠拆分或非法/饱和值时返回null，不把反推负数当真实基础。最终战斗数值、成长和装备贡献不变，不重写存档。新增三项边界检查，stats最终10/10通过；UIlead已接稳定API并以“合计 N”与run列“—”处理不可拆分数据，未将null当0。consumer接好后全仓strict TypeScript与本范围diff-check通过。此修正独立于成长公式及根cast机制。根随后按用户覆盖需求继续修改ballistic飞弹，本域遵照协调暂停cast集成检查，不宣称其最终验收完成。
### 最终稳定版集成确认

根通知新版physical ballistic及分时双重稳定后，本域仅运行 `src/engine/index.test.ts` 与 `src/engine/growth-and-anchors.test.ts` 一次，16/16通过。确认首波自动清波、历史等级真实成长且不自动回蓝、实际跨级最终法力回满、三角色26/50/74发射/射程和真实beam脉冲均保持；原double时序断言已由根修正并通过。本域未改根cast文件、未重跑整仓或发起UI视觉检查。成长、路线、锚点和来源修正验收完成，释放本域文件；后续新机制由根协调整合。

## 怪物体型共享数据与真实攻击事件（2026-11-04，完成）

根确认接口后复用原内容 Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4`，仅独占新增 content/monsters.ts 与 monsters.test.ts；原健康任务正常完成并释放，无模型切换或新顶层任务。根持有 contracts MonsterBodySize/CombatEntity.bodySize、碰撞/素材/死亡效果接线；UIlead持有sprite尺寸/HP条和攻击bob。Sol仅在 waves.ts 原 territoryAttacked 增加 sourceEntityId、targetId=territory、x/y，保留 enemyId及原伤害字段；没有新增enemyAttacked或重复伤害，也不改模拟y。新增waves单项真实攻击事件测试验证一次扣盾、完整来源坐标、冷却期间不再发事件，未重跑原波次矩阵。

MONSTER_SIZE_PRESETS 提供 small/normal/large/huge/colossal，像素24/32/48/64/80，世界碰撞半径0.75/1/1.5/2/2.5；monsterDefinitions映射 enemy-basic/boss-minor/boss-major/boss-apex 到 normal/large/huge/colossal，素材key为 monster.basic/monster.boss.minor/monster.boss.major/monster.boss.apex。getMonsterSize(entity Pick definitionId/bodySize) 返回detached{id,pixels,hitRadius}，合法显式bodySize覆盖定义，非法runtime size退定义、未知定义退normal。默认体型不冗余写入spawn实例；共享数据与asset深冻结，定义查own key防prototype-like字符串误取对象。

Sol已实际读取实现和调用流程，确认normal半径保持1、boss同比增长、override/fallback/原型键白名单、数据冻结与副本独立。修正测试对readonly返回类型直接赋值的TS问题，保留mutable test view验证detached副本，不改helper运行行为。执行者monsters定向5/5通过，最终typecheck通过；Sol真实territoryAttacked定向1/1通过，本范围diff-check通过。未跑整仓/build/旧波次矩阵，未改rootcast/碰撞/UI/save或提交推送。稳定导出和事件字段已发根及UIlead，视觉及其消费接线由相应负责人继续验收。

## 领地全量修复与无玩法上限升级（2026-11-04，完成）

按根授权复用两个原健康Luna：`01a1a240-1411-7642-8951-44f5de00abbc` 独占 content/territory.ts；`01a1a240-16cd-7392-be82-9400fc3c5fec` 独占 runtime/territory.ts 与 territory.test.ts。Sol实读helper、事务与测试并补下一步价格/容量安全边界用例；两个任务均完成释放，无模型切换。根负责contracts/protocol/projection，构筑Sol `01a1a190-f915-7e63-b995-4fdb7bf581f7` 持有runtime/index.ts路由及runStatistics，UIlead持有界面，本域未并写这些文件。

getTerritoryRepair(state,track) 返回 track/current/maximum/restore/cost/allowed/reason(full|coins|phase|invalid)；wall按缺失量×0.5、shield×0.3向上取整，有缺失至少1金币。满值包括旧档0/0护盾restore0/cost0不可付费。applyTerritoryRepair复用预览提交一次 territoryRepaired {track,cost,increase:restore,hp,shield}，原子扣费补满该轨道，不改变另一轨道、等级或上限。满值ALREADY_FULL、金币INSUFFICIENT_COINS、时机INVALID_PHASE、非法数值INVALID_STATE，拒绝返回原state和空events，router负责命令ID去重，不另造去重表。

getTerritoryUpgrade移除rules.maxLevel和maxLevel reason，金币够可持续升；价格仍当前wall等级×20/shield×15，增量仍wall20/shield10，同时加当前与上限保持受损差。nextLevel:null仅为非法/越过JavaScript安全数值边界的保护：levels为安全正整数，价格、当前/上限增量、金币等finite非负且不超过MAX_SAFE_INTEGER；事务revision/nextEventSeq的下一增量也必须安全，gameTimeMs有界。ready/reward/显式暂停battle允许，defeat禁止借此复活。数值为暂定原型，已记design/mechanics.md。

开发中执行者delete/recreate runtime模块造成导入缺失和live页面空白，根反馈后已立即要求优先恢复完整文件再测试，禁止继续长时间删除在用模块；文件恢复已核对并通知根及router，没有把中间态描述为可用成品。最终Sol实读验收通过：执行者territory定向9/9，Sol新增安全价格/生命容量/护盾容量溢出单项1/1通过；最终全仓tsc --noEmit与本范围diff-check通过。构筑Sol独立报告真实router统计/修复/命令幂等5项通过且支出不倒扣累计收入。未跑旧整仓矩阵/build、未动UI/rootcast/save或提交推送。稳定helper导出、事件、拒绝码已发根/UI/router，本域三文件释放，界面视觉由用户确认。

## 城墙与护盾独立自动恢复（2026-11-04，完成）

根授权独立新模块，不改root engine/index.ts、runtime/index.ts、contracts、UI或protocol。复用两原健康Luna：`01a1a240-1411-7642-8951-44f5de00abbc` 独占 content/territoryRecovery.ts 与 content/territory-recovery.test.ts；`01a1a240-16cd-7392-be82-9400fc3c5fec` 独占 runtime/territoryRecovery.ts 与 runtime/territory-recovery.test.ts；Sol独占 engine/territoryRecovery.ts 与 engine/territory-recovery.test.ts，负责实际审查、集成协调及追加回归。新模块均一次完整Add落盘后通知根消费，没有再次删除在用模块造成导入空窗。两worker已完成释放，无模型更换。

getTerritoryRecovery(state,track) 返回 track/level/unlocked/rate/nextRate/cost/allowed/reason(coins|phase|invalid)，复用旧territory数值校验及track validator；缺失repairLevel为0。两个轨道独立，unlockCost300，后续价格150×当前能力等级，wall每级1生命/秒、shield每级2盾/秒；冻结配置集中保存，等级线性无玩法cap，仅安全整数/派生价格及速率边界。现有速率不因金币不足或购买时机不符归零；getTerritoryRecoveryRate(territory,track)供引擎纯取速率，不依赖金币/phase门禁。初始化显式0由根接，旧档仍以缺失0兼容，checkpoint保存等级，新局清回0。

applyTerritoryRecoveryUpgrade仅提交对应wallRepairLevel或shieldRepairLevel，扣金币并安全递增revision/seq，发一次territoryRecoveryUpgraded {track,level,cost,rate}，不立即修复、不改容量或另一轨等级，不写统计/另建命令去重。准备/奖励/显式暂停battle可买，defeat和实时战斗拒绝；原子失败返回原state/noevents，安全元数据guard沿旧事务模式。

advanceTerritoryRecovery(state,dtMs)只在battle且未paused/未backpackOpen、hp>0且合法时推进。每轨按已scaled dt秒数累加至真实上限，不重乘state.speed，不另timer、每tick事件或扣钱；未解锁/非法当前轨等级不恢复。先比较seconds与gap/rate再乘，极大有限dt也不会产生Infinity。根将调用放在每50ms子步enemy伤害及defeat检查之后，死亡同slice不能靠恢复复活；本域未改根入口。

Sol实读修正：初版shield系数误为0.5，核对根及用户无新覆盖后改回2；清理重复isRecoveryPhase定义并复用门控；更正runtime测试将坏shield等级却对wall命令预期拒绝的问题，移除曾为该错误预期加入的无关轨guard，额外双向回归验证一轨NaN不阻止另一健康轨交易。根新initial显式0后，仅legacy fixture删除两字段模拟旧档，未逆改生产初始化。

实际检查：内容6/6最终通过（初次重复函数transform失败后修复复跑），初始0变化后legacy单项1/1；runtime原7/7及收敛后safe metadata单项1/1、Sol独立轨单项1/1；引擎5/5覆盖独立恢复、暂停/背包/其他phase、hp0不复活、上限及巨量dt、非法level、20×50ms与1s一致和速度只由caller换算。两个worker定向strict与范围diff通过；根报告真实跨layer恢复/引擎/投影9/9通过。最终全仓strict按根要求等待UI新Props齐后统一执行，不重复撞中间态；本域未跑全仓/build、未改UI/save或提交推送。design/mechanics.md已记暂定价格/速率与两轨规则，稳定API/事件/接线位置已交根，本域文件释放，视觉由用户确认。

## 具体魔法奖励介绍（2026-11-04，完成）

根授权本域新增 magicDescriptions.ts/test 并接 randomRewards.ts，不改 runtime/index、UI、契约或战斗。复用唯一原内容Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4` 独占 content/magicDescriptions.ts 与 magic-descriptions.test.ts；Sol负责 randomRewards.ts 物品生成接线、真实机制/产品短句实际审、抽卡不变性检查及文档。原健康任务正常完成释放，无新顶层任务/模型更换。

export enrichMagicReward(reward:RewardOption,content:ContentCatalog):RewardOption 始终返回detached新对象，已知item按effect/impact/element及fireball加速等真实行为替换description，不改ID/kind/definitionId/label/grade/effect/amount/details。未知定义、原型保留键、非item或未知效果保原说明，不枚举泄露其他内容。randomRewards item分支调用同helper并移除旧通用“获得此法术或奥术，发现其定义并存入共享背包”；不增加随机调用，不计算另一套品质/角色叠加伤害。根持有runtime构造时map旧rewards及领取/持久化测试，原卡不重抽，后续领取快照自然保新介绍；本域不改根router。

Sol实查纠正火球举例：当前fireball无splash，只有逐渐加速及接触伤害；与根核对后不因文案需求改AOE或捏造周围伤害。水系真实damage事件确实冲洗附近血迹，回春/生息恢复领地生命、光盾恢复领地盾，射线持续脉冲，连锁逐跳降伤，穿透直线有限目标；double相邻攻击分次连发且治疗/盾重复、split相邻飞弹/射线同时分支。初版motif氛围套话与否定/实现说明未达产品要求，根及Sol反馈后整段删除，收敛到30种各自可区分的短用途句，目录均≤45字；水系单句、射线用该法术名作主语。未知行为保旧说明，不补另一条通用垃圾话。

实际验证：执行者magic-descriptions最终6/6（首次潮涌旧断言失败，随最终短句同步断言后复跑通过），覆盖30目录、重点机制、effect变更、未知/原型键、clone及字段保留；执行者typecheck和两文件diff通过。Sol原randomRewards定向7/7通过；额外真实四物品卡脚本确认仍12次RNG draw，原ID/kind/definition/grade/details保留且description具体化。本范围diff-check通过，未扩跑战斗矩阵/build、未触用户IAB/save或提交推送。根已实读最终短句符合并接旧卡map；本域三源码/测试文件释放，根后续独占runtime/index继续其他工作。

## 装备、普通药水目录及真实击杀掉落（2026-11-04，完成）

用户明确allitems包含全部背包分类，并要求头盔护具真正可穿、敌人能掉装备。根授权本域数据与新loot模块，根/构筑/UI分别持有契约、穿脱/药水命令、背包/属性展示、协议过滤和当前档补齐，本域未越界写其文件。复用原内容Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4` 独占 content/gear.ts、supplies.ts、gear-supplies.test.ts；复用原Luna `01a1a240-16cd-7392-be82-9400fc3c5fec` 独占 engine/loot.ts/test；Sol持有demo.ts目录导入、实际验收与文档。两健康任务已完成释放，没有新顶层任务或模型切换，新文件均一次完整Add，不删除在用模块。

gearDefinitions含8件1级白板、每slot两件：apprentice-hat/astrologer-hood、rune-robe/heartguard-armor、swift-boots/farwatch-boots、copper-ring/spring-pendant。createGearFromDefinition(def,id,grade=def.grade)生成definitionId/name/slot/level/grade/null owner及独立statBonuses，按共享gradePower实例/定义比例缩放有限白名单字段及合法元素键。静态定义/shape/asset/bonus深冻结，实例独立可变，无反向loadout依赖。asset.label改定性作用，避免白板固定数值冒充更高品质实例实际贡献；只增强已有真实属性，无角色HP、护甲减伤或移动速度假机制。

supplyDefinitions含health-potion领地生命40、shield-potion领地护盾30、mana-potion全队法力50，1级白板、1至2格。createSupplyFromDefinition仅生成独立id/definitionId/level/grade，效果不复制入实例，根运行时读取定义按同品质比例使用。demoContent.gear/items由Sol接入。获得后分别入state.gear（未装备）/state.supplies，不混入magic items/backpack；knowledge.gearIds/itemIds随获得去重发现。

grantEnemyLoot(state,enemy,sourceLuck,content,emit)由根在每个真实enemyKilled之后调用一次，沿nextCombatRandom保存流，不另造随机源、伤害结算或死亡账本。普通gear基础8%加(state.luck+原发射幸运快照)×0.001，最高30%，药水独立4%；第一次装备仅在registry空且knowledge gear也空时保底。boss-minor/major/apex保证装备（无gear目录回退药水），品质底线rare/epic/legendary；最多每次gear1+supply1，品质权重60/25/10/4/0.8/0.2。只从当前目录合法own定义抽取，空目录不伪造；ID检查所有registry key及实例id、法杖/角色/实体与背包，避免覆盖。emit lootGranted {enemyId,kind:gear|item,instanceId,definitionId,grade,x,y}，不默认泛通知、不直接穿戴/使用。概率、品级与基础属性均为原型，详表已记design/content.md。

Sol实际审修正boss等级表原型键误保底、NaN/-Infinity HP误认真实死亡、跨registry actual id冲突与validAsset未知object类型收窄。执行者数据/factory8/8、loot10/10最终通过；Sol额外脚本验证epic帽子合法穿戴后最终法力+30/恢复+1，epic靴子真实编译冷却÷1.1/飞弹速度×1.2；根stepBattle真实飞弹接触→致死damage→enemyKilled→首次gear只掉一次，下一步不再发放。最终全仓tsc --noEmit及范围diff-check通过，未跑旧全矩阵/build或改rootcast/UI/save。根已接真实settleDeaths并获当前run全类别.02补齐所需稳定API；本域未声称代操作用户存档。所有本域文件释放停止编辑，无提交推送，普通发现过滤及用户视觉验收仍由相应负责人收口。

### 装备统一单格补充（用户最新覆盖）

用户随后明确四槽装备没有不同体积，统一占一个背包格，法杖容量独立。复用同两worker窄改：gearDefinitions八件shape全部为唯一原点格[{x:0,y:0}]，目录测试强断言精确单格；loot gear候选严格校验安全整数原点单格，多格和偏移格不可掉落。supplies继续原1至2格规则，不改装备数值、factory、品质、概率、法杖或UI。Sol实读实际数据、gear专用校验与新增用例通过；仅两个目标用例各1/1及必要strict/范围diff通过，没有重跑旧18矩阵。design/content.md同步单格规则，公开catalog随真实定义单格而非仅UI压缩。两worker再次释放，本域停止编辑。

## 飞弹性能测量、候选缓存与弹体半径（2026-11-04）

根先授权只读测量，临时基准/JSON/main线程CPU profile均在ignored .local/work。以512条历史（运行时实际裁切量）、3角色6法杖24法术位、混合直击/穿透/范围/连锁弹体测试100/300敌与弹、1x/5x；另测现实波次上限60敌。没有把1万/5万历史的裸engine压力数据归因于正常runtime。初始512 active profile的热点为飞弹推进/碰撞/目标查询，编译与getStats约1.5% self、等量5子步编译只约0.20/0.49ms，不优先做编译缓存。完整只读报告与数据见.local/work/engine-perf-report.md。

根随后授权最小实施。复用原Luna `01a1a240-16cd-7392-be82-9400fc3c5fec` 独占 projectileCollision.ts/projectiles.ts；原内容Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4` 独占新projectile-collision-cache.test.ts，先保存旧全遍历公式作独立reference。Sol不代写实现，实际逐行审数学与调用链、独立前后测量与验收。保留每次advanceProjectiles入口构建enemy reference/radius候选缓存，所有legs复用，query实时重查HP/faction/kind/坐标/excluded；同slice前弹杀敌不会被后弹撞死体，半径从getMonsterSize每entry重建，不存档/跨步保留，不改targets/impact/RNG或事件顺序。

相同150样本、512 history、5x主动施法、怪物/弹体旧半径的公平前后比较（p50/p95 ms）：60敌100弹2.96/4.58→2.06/3.08，60敌300弹6.38/8.36→3.90/4.59，300敌300弹15.67/23.53→10.86/11.79。现实60/300最终median下降约39%、p95约45%，复测也同向，但共享host有波动，不承诺UI帧率或独自解决全部卡顿。根另持有runtime持久化及UI祖先观察器修复。曾按根授权试作有界稀疏grid，三组全面退步（4.05/6.68、7.30/17.14、22.26/48.74），立即精确恢复cache-only；没有留下grid/Index/benchmark专用分支，也没有为数字换fixture。

独立cache/reference5项与原collision4项均实际通过，涵盖64段/多大小混合样本、擦边/同距ID tie、排除项、同slice死亡与真实穿透A/B/C、下一entry读取新半径、neutral RNG及事件顺序。必要strict/diff通过，没有扩跑旧矩阵。根随后单独确认可见边缘玩法扩大：firstProjectileCollision新增第6可选projectileRadius默认0，legacy reference明确按0不变；实际advance统一传PROJECTILE_HIT_RADIUS=0.4。扩展擦边单独测，不按法术ID散写，不把根新的怪半径及负y出生混入上面的纯性能比较。根持有monsters/waves改动；本域不触UI/root index/runtime。三源码/测试已释放，非发射area新机制另行授权实施，不混入此性能验收。

## 非发射区域技能、新奥术透传与全法术配方（2026-11-04，完成冻结）

根授权真实非发射技能并持有contracts、compile起始area支持、engine/index接线/失败清理、projection和当前档grant；本域不越界写根文件。复用原内容Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4` 独占新content/areaSpells.ts/test、magicDescriptions.ts/test、magicRecipes.ts/test，expanded-spells.test.ts仅目录count更新；原engine Luna `01a1a240-16cd-7392-be82-9400fc3c5fec` 独占新engine/areaEffects.ts/test和effects.ts dispatch/编译元数据透传。Sol负责demo统一目录接入、targets.ts按根授权仅damage来源增加areaId一行、实际代码审、真实stepBattle验证、文档。构筑Sol另持expandedArcana/grade-scaling/compile及真实merge验证，文件互斥。所有本域源码/测试现冻结释放，不再扩内容或重跑全套。

3新增ID为thunder-strike落雷、frost-ring冰环、earth-spikes地刺，effect area与mode strike/ring/eruption真实控制位置/时间，未用隐形projectile或beam。spawnAreaEffects返回是否实际创建，调用者统一扣一次法力/冷却；advanceAreaEffects只在正常battle推进，paused/backpack冻结。ground modes施法时锁地，预兆后一次圈内碰撞，敌人移走可miss；ring从原角色共享anchor扩散，以前后波前与敌body交叠判一次contact。伤害复用applyContactDamage的精准/暴击/sourceLuck与原source XP，事件damage用areaId。Double/split复用castPattern：120ms后续bursts、同时多个锁地点/同心不同展开时长的真实多环，每分支独立伤害；不静默忽略area split。perCast8/alive32/每实体最多8目标/radius100/总等待加active寿命≤5s，击中包括miss均消耗contact，不能多帧重复打同敌。

Area时钟复用launchDelayMs与remainingMs：前者是剩余预兆/双重等待，等待时remainingMs保持active duration；激活后删除前者并emit areaActivated，再扣active remainingMs。area snapshot保实际delay/duration/radius，ring编译range联动至最终radius且钳100，视觉与物理不分叉；ground castRange独立于局部radius。Sol纠正未知caster回退假中心、single-target split把负y点clamp0、ring override绕过最大半径预算三个问题。根每slice接advanceAreaEffects并在失败清area，清波原全实体清理防跨波伤害。

新增5奥术haste/efficiency/reach/velocity/area的数据和编译由构筑域完成，本域demo append其expandedArcana，当前29spells+9arcana=38；描述按modifier给真实短句、unknown仍保原，广域明确含区域/溅射/连锁并加宽光束。effects CastSpec新增optional impact/beam/area并以编译spec优先于模板，防广域实际几何被原definition吞掉。Source列控范围未扩compile/targets/impact其他语义，未捏造减速/冻结/DOT/角色HP。

magicRecipeDefinitions20条真实相邻异名合成，baseMagicDefinitionIds9起点，首fireball-recipe保留；旧29spell无新增数值，9根+20产物覆盖全目录，ID/产物唯一、全inputs已定义且有向无环。demo.recipes替换真实表，不另造UI假路线；与同名升品质机制分离。根按输入知识自动发现配方，手册及普通协议未知节点仍过滤，静态全表不作为普通发现直出。

实际验收：区域engine8/8最终通过（delay/锁地移走miss/扩散去重/crit-miss/分时多分支/预算/编译geometry覆盖）；内容3新定义+区域描述初批10/10、旧目录count1/1；新增5mod后最终描述8/8覆盖38目录；Sol集中recipe结构/覆盖/DAG3/3通过。主Sol真实stepBattle逐个3招确认kind area、无projectile/beam、spawn无瞬伤且法力只扣一次、随后24/12/30基础伤害areaId；第二角色area击杀只原施法者XP+10且不重放。构筑域独立new modifiers4/4含编译→cast实际ring radius32.5命中原射程外目标，以及2/2真实public merge（落雷与含广域材料的地刺，邻接失败原子无吞/成功进bag再装杖compile）。最终本域整仓tsc与范围diff通过，不重复旧全矩阵/build。

根后续已报告index/projection/recipeKnowledge路由完整接齐，当前run波25缺失8新魔法grant真实ACK executed/granted8且保金币和布局；这是根持有的用户存档操作，本域未代操作。根全量中旧飞弹时序assert因有意扩大碰撞半径从300ms变250ms，由根更新并继续统一最终检查；本域没有为旧断言缩回新半径。手册/UI/library收尾及视觉由用户确认，未做AI视觉验收，无本域提交推送。

## 持续区域、雷暴与移动风暴（2026-11-04，完成冻结）

根已实际落地ProjectileImpact.field、AreaSpec.field/vortex及tick/anchor/move/pull字段、CombatEntity.travelledDistance。复用原engine Luna `01a1a240-16cd-7392-be82-9400fc3c5fec` 独占projectiles.ts、impact.ts、areaEffects.ts与新focused engine测试；原内容Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4` 独占新fieldSpells.ts、magicRecipes.ts、magicDescriptions.ts及相应数据测试。Sol持demo接入与独立field-integration.test.ts，必须实际审代码/真实stepBattle后才能记完成。构筑Sol另持compile的广域field/vortex几何、quadruple/sextuple奥术以及三输入雷暴真实合成测试；根独占contracts、index、projection和用户存档grant。没有新增聊天或改变健康作者模型。

本批目标为33法术、11奥术、24配方。field弹仅按真实路径累计射程；contact命中、range终点、either较早者触发持久区域，首伤等tick且不叠一次直接伤。雷暴固定全场中心，仅伤害中心位于0..100屏内的敌人，负y预生怪排除；风暴为有限寿命area，以存档坐标保存确定性移动路线并每模拟片拉近敌人，非召唤/宠物。局部pulse最多8目标、全屏最多64，共享alive32与5s总寿命预算。此段仅记录任务与约束，运行结果尚待作者完成及Sol验收。

同批用户明确纠正雷链为即时首击后就近逐跳传导，优先于旧文档“连锁飞弹”。根已加effect/kind chain；第三原Luna `01a1a240-1411-7642-8951-44f5de00abbc` 独占新engine/chains.ts及test，其他健康作者继续当前任务。Sol统一effects dispatch、targets damage来源chainId、demo四旧雷系定义改chain去speed；内容作者改描述与原扩展法术测试，构筑Sol纳入chain攻击型修饰，根接advance/清理与投影，UI接chainArc。目标为首支立即命中，后续80ms模拟间隔、从上一命中位置选最近未命中活敌，120ms双重延迟与同时分支，共享alive32/perCast8、hitIds/falloff及原角色来源；尚未运行验收。

最终实现已完整接demo，33法术、11奥术、24配方。field与vortex可用5s寿命预算，旧三mode仍保持2s上限；首tick至少200ms，局部8与显式global64分开，未给anchor不能自动提升global。风暴从角色锚点朝固定屏内路点(15,20)/(85,20)/(85,80)/(15,80)游走，targetX/Y保存下一点，每片真实移动与按秒牵引；不是围角色脚边的小轨道。field射程只写field弹travelledDistance，普通弹snapshot与运动规则保持；碰撞缓存和0.4半径保留。根每片在推进飞弹前保存areasAtEntry，传给advanceAreaEffects第4可选候选参数，使碰撞新生field从下一片才计首tick，不增bornAt契约或隐藏延迟。

Sol逐段实际审projectiles/impact/areaEffects/chains/effects/demo/targets，修正了局部64误用、火场2400被旧2000截短、tick50与约定200不符、旧弹无条件新增travelledDistance、风暴只绕caster小圈、anchor缺省误升global、未知caster假中心、chain非必要range120截断与expire后remainingMs复活。调用链为compile→effects→真实projectile/chain/area；field碰撞仅生成area，area每pulse重选仍活目标并复用applyContactDamage；chain每段chainArc且damage携chainId。原施法者attackRoll/luck/物品与角色归属快照保持，根结算XP/掉落，无UI规则副本。

实际结果：原engine定向26/26、即时链6/6；内容定义/描述/配方18/18，扩展目录与即时链3/3；构筑Sol三输入雷暴真实合成1/1（断开拒绝不吞、三份原子消费、单事件、3×3产物可装杖编译），先前新广域及4/6连发3/3。主Sol独立field-integration.test.ts最终4/4：两fieldbolt真实cast扣蓝→飞行→area，出生后399ms无伤、第400ms首pulse、再400ms重击同敌且无直接伤；雷暴两屏幕角落伤而y=-.01预生怪不伤；风暴移动/牵引/pulse且JSON存档后800ms与16×50ms同态、暂停背包冻结；4旧即时链首步伤害无弹、后续仅第二活敌、来源与单次扣蓝正确。最终整仓npx tsc --noEmit及范围diff通过；没有重复全性能矩阵或独自宣称UI视觉验收。

所有本域源码/测试已释放冻结。根已获可grant新4法术的完整结果，用户存档发放、UI、最终全量检查与新机制高负载验证由根统一；本域没有擅自grant、改用户保存布局、commit或push。原作者均健康完成，未切模型或中断任务。

## 普通怪物种类与波次混合（2026-11-04，完成冻结）

用户指出种类少且同色，根授权本域数据/出生规则与UI域并行。继续复用健康native内容Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4` 独占monsters.ts/test，engine Luna `01a1a240-16cd-7392-be82-9400fc3c5fec` 独占waves.ts及相关wave/growth/offscreen测试。Sol持新monster-variety-integration.test.ts、实际代码审和文档。已向根及UIlead冻结六个ID与颜色体型：enemy-moss苔团small绿、enemy-ember焰灵small橙红、enemy-frost-moth霜蛾small冰蓝、enemy-shadow-bat影蝠small紫、enemy-sand-beetle砂甲虫large黄褐、enemy-crystal-crab晶蟹normal蓝紫。旧basic与3boss保持；UI域另持多色图稿，本域不写UI。

普通定义新增spawn配置，含解锁波次、生命/伤害/速度/攻击间隔倍率及可选现有movementMode；getUnlockedMinionDefinitions从同一定义筛出普通种类。首波原basic不变，后续按出生序号轮换已解锁种类，不额外消耗RNG；波28应可遇全7种。首领节点、数量、60上限、旧已生实体、加速和负y进入保持，不重置用户局、不添加远程/分裂/免疫机制。此段为实施约束，验收待作者完成。

最终两原native作者健康完成且源码释放：内容monsters.ts/test增加6种，共7普通+3boss；waves.ts/test统一按解锁目录选普通，普通序号排除此前首领节点，移动模式优先定义否则旧parity。首次波保持全basic、首只直行；boss仍用原参数与出生节点，同一原有随机抽样决定x与hunter目标，未增加RNG调用。旧实体推进不按定义重算，只有后续新生实体使用倍率，因此当前局不用重开。Sol实际逐段审定义helper/冻结和waves选种/参数/移动/出生事件，并纠正高波次先把原基础间隔钳400后再乘种类倍率、最后保400下限，避免慢怪倍率被负的基础公式抹掉。

实际验证：怪物定义6/6（7普通3boss、稳定颜色尺寸、解锁、倍率、冻结和fallback）；wave/offscreen/growth17/17（首波友善、种类优先移动、单随机抽样、按定义真实倍率、wave28全部7种、首领节点、加速与负y进入、旧追踪目标回退）；主Sol独立monster-variety-integration.test.ts 2/2，wave28中途JSON保存/恢复后继续出生与原状态全等，总59实体内实际含7普通种类/7色/多种HP和速度及正确碰撞体型。另以实际出生七种由真实stepBattle施法击杀，确认7条enemyKilled原definitionId与角色来源、按各maxHp计个人与团队XP、普通lootGranted正常，事件经现有accumulateBattleStatistics计敌7/首领0且不重放。统计验证使用runtime已有事件消费者，不另改runtime规则。

最终整仓npx tsc --noEmit和范围git diff --check均通过。内容作者早先类型检查碰到UI正在重写模块的瞬态缺文件，由UI恢复后主Sol实际重跑通过；未把瞬态描述成仍失败。docs/design/content.md新增实际参数表，稳定ID表已直接同步根与UIlead。没有本域UI、存档reset/grant、依赖、commit/push改动；多色轮廓表现由UI域完成并由用户确认，本域不宣称视觉已接受。

## 同轮奖励语义不重复（2026-11-04，内容域完成）

用户明确撤销同轮允许重复的旧规则。复用健康native内容Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4`，独占content/rewards.ts、randomRewards.ts及两个对应tests；根持runtime已展示offer迁移、知识发现与持久化，未争文件。导出getRewardOfferKey、dedupeRewardOffers、fillUniqueRewardOffers；buff按effect.type、coins全同项、item按definitionId、heal按领地生命对象、character/wand按定义或默认对象，不用label/id/grade/amount判断重复。实际候选池按剩余类型权重与类型内语义抽取，抽中即从有限池移除，耗尽返回较少，不无限重试；仍允许四个不同属性或不同法术且不固定类型位置。

迁移保留首unique原对象、内容、ID与顺序，重复槽新卡用稳定新ID并避开全部原卡ID，防旧点击/远程claim领取别的奖励；已唯一四张不采样不消耗RNG。Sol实际审完整helper并发现“替换a可能复用另一旧重复ID a:unique-v1”的边界，作者增加reservedOldIds和对抗用例后修正。最终内容13/13、类型与diff检查通过，源码冻结释放；根另报告constructor仅reward非空且检测重复时接迁移、2/2定向过，不为phase reward空测试暂态填卡。

## 统一命中状态（2026-11-04，完成冻结）

根已实际落公共OnHitSpec/BurnStatus/EnemyStatus；复用空闲engine Luna `01a1a240-16cd-7392-be82-9400fc3c5fec` 独占statusEffects.ts/test及waves.ts/test，空闲内容Luna在奖励冻结后独占demo/areaSpells、magicDescriptions及focusedtests。构筑Sol持compile深快照及其test，主Sol持新damage.ts、targets、四载体onHit快照/真实heading与status-integration.test.ts。根独占index/projection/runtime，UI另域；原runtime性能native作者继续scratch只读测量，不被打断。

统一真实accuracy/crit命中且有伤害、敌人仍活才调用onHit；damage.ts抽取原HP/来源emit核心供接触与周期复用，避免targets/statusEffects运行环。周期burn无accuracy/crit重抽或递归onHit，damage使用statusId/sourceKind=status/statusType=burn，不造projectileId，保存原角色/物品/法术/luck。slow取最强，等强刷新max剩余、弱者不延长强者；只按有效时间缩放实际位移，不永久改base speed/moveSpeed/ramp。burn按char+item+definition同源刷新max伤害/寿命、不推迟原tick；每敌最多4来源、tick至少200ms、寿命至多5s。击退沿真实heading，x0..100、y可负且上限100，事件distance为实际受边界限制后的位移。

实际完整接入顺序由根index确定：advanceEnemies及领地失败guard后，advanceEnemyStatuses并立即settleDeaths，再territory recovery与攻击推进/施法；既有slow先影响本片移动，再扣TTL，burn本片击杀先于新cast结算。四载体与编译均深快照onHit，field从原projectile继续保留，beam/chain记录真实heading；普通无onHit攻击不增加状态处理或额外克隆。内容冻结5项：风刃击退2世界单位；水弹75%速度1200ms；冰环50%速度1800ms；火球20%快照伤害/600ms/2400ms；炎流15%/600ms/1800ms，未改变原力量、射程、法力等或火球无溅射。通用介绍仅根据onHit追加效果，避免把世界单位说成背包格。

Sol实际审完整statusEffects、waves分段积分、四载体、effects/targets/damage与内容，补正载入burn数组仍最多4、载入slow TTL钳5s、击退上界/实际距离；目标已死不再伤害/施加，miss不触发，保持现有pierce目标预算与缓存实时坐标查询。准确事件为statusApplied、statusExpired、knockback；slow未在公共契约存施加者，因此slow过期只带target/status ID与type，不虚构来源；burn过期与damage均保原来源。

实际验收：engine状态与waves18/18，内容5配置/描述与area14/14，构筑深快照1/1；主Sol独立status-integration.test.ts最终4/4（真实风刃推位；真实accuracy miss不能击退或烧伤；水弹慢速比同态无slow少位移且基线速度/ramp保持；火球burn JSON存档后无RNG/crit并原角色/物品/法术击杀XP10且不重放）；damage抽取旧actor-combat7/7与collision-cache5/5通过。最后文案微调后描述11/11复核通过，整仓npx tsc --noEmit与范围diff通过。内容作者早先碰UI模块短暂缺失，恢复后主Sol实际全量类型检查已过，未遗留失败。

本域源码/测试已全部释放冻结；根持UI/projection与最终全局整合。没有改用户存档、依赖或提交推送。CPU测试只在runtime基准窗口结束后运行；性能作者的同snapshot测量另记，不把本次状态功能检查或Node测试耗时当浏览器FPS。

## 真实runtime通知性能证据（2026-11-04，测量完成）

用户仍卡顿，根要求从createGameRuntime.tick与通知测量，不再仅测孤立stepBattle。复用原健康native Luna `01a1a240-1411-7642-8951-44f5de00abbc` 独占忽略目录.local/work/runtime-perf-2026-11-04/，没有生产源码、依赖、用户存档或UI修改。脚本使用3角色6法杖/30装杖/44背包，main保存gate、App快照回调、agent有界去重三订阅及250ms投影/200事件ACK；Node不含React渲染/layout/真实HTTP。每速20秒等量模拟，1x400个50ms调用，5x80个250ms调用，各400模拟子步，不能冒充各20秒真实墙钟或FPS。

Sol实际审fixture/仪表/JSON/报告：原强构筑标准场景虽始60敌但很快清空，均8敌/1弹、峰61敌，不接受作持续60敌多弹压力。作者最小追加58敌+100由真实spawnProjectiles生成弹的压力checkpoint，延迟500ms新生，峰60敌113弹、均26敌14弹，20模拟秒77击杀、26出生、283后续新弹，仍battle。未硬改每tick状态补怪或关闭真实伤害。before普通三rep与压力单rep都在同一source snapshot，same-speed普通/instrument完整摘要一致；跨速核心/角色/法杖/实体/统计同态，压力仅保留事件历史顺序因通知节奏不同而有差异，摘要与history分列，未隐藏差异。初次读到一新一旧中间文件的摘要不等已追查并以最终一次driver输出验证匹配。

before报告在.local/work/runtime-perf-2026-11-04/report.md及data/profiles。实际压力instrument 1x notify1495/总2054ms（约73%），5x346/538（约64%）；通知克隆占绝大部分，compile分别65/38ms、统计2/.5ms，故不先做编译缓存或另加engine复杂索引。主Sol从JSON复核并纠正报告残留旧run p95/mean，报告数须以最终数据计算。完整clone调用链为队列state/events各一次，加每full listener state/events各一次，三listener每批4份大state+4份events，engine入口另有一次stateclone。

根据此独占实现backward-compatible subscribeEvents摘要/事件订阅，main保存gate和agent缓冲迁移，UI仍fullstate独立clone，队列快照、注册顺序、重入/回调隔离保留。根另报告API/奖励恢复/投影/连接/存档14项及tsc通过，本域不争runtime/main/contracts/agent文件。按新同source exact bundle追加压力3full对1full+2events，避免状态/奖励增量造成跨源码假比较，旧before产物不覆盖。after hash为29180a3fe901e889ae0753fef78e5fbee32fa7d77baca47620cc8278f44b2ad6，数据在data/after/，same-speed完整摘要分别911e2d8a...和be43bb6e...在两模式严格一致。

Sol直接读after JSON确认：大state通知复制4→2，全部notify structuredClone次数8→6（剩余为events）。1x压力3full平均tick5.016/p50 4.690/p95 6.935/max15.384ms→事件模式平均3.414/p50 2.978/p95 6.342/max10.524，平均下降约32%；notify总1471→815ms、clone1457→801，而step531→547ms近似同量。5x平均9.731→4.677，但step自身298→180显示主机/profiler波动，不能将全部52%当通知收益。GC1x37.73→33.34ms，5x22.94→11.27ms。全部为有界单rep压力证据，不承诺浏览器帧率或独自解决所有卡顿。真正计时窗口与根大test、UI DEV/PROD采样串行，exec结束立即释放，不为写报告占CPU窗口；最终after摘要与报告由作者仅从冻结JSON整理，无继续跑矩阵。

## 奖励刷新报价与幸运/采集内容（2026-11-04，领域完成冻结）

根已落RewardRefreshState/Quote、RewardBuffType.luck及refreshRewards命令契约，并独占runtime/index、contracts、protocol和用户当前offer迁移。Sol独占新runtime/rewardRefresh.ts/test的纯计算；原健康native内容Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4` 独占randomRewards.ts/test补幸运六档与实际金币概率介绍，不碰奖励事务/存档/UI。

helper完整导出normalizeRewardRefresh(value:unknown,wave:number)和getRewardRefreshQuote(state:GameState)，返回新对象，不修改state或抽RNG。波次有限floor至0..MAX_SAFE；非法计数归0，同波保freeUsed，异波只清freeUsed，paidCount与refreshCount本局跨波继承。免费总额floor(wave/10)且优先使用；付费下一价3^paidCount，超过safe integer则null，仍可用免费；refreshCount到MAX_SAFE禁用防ID碰撞，phase须reward/非空offer/安全整数金币足够当前价。实际扣费、计数递增、换四卡、offer新ID、幂等与checkpoint仍由根原子执行。

Sol helper实际6/6过，覆盖免费十波边界、跨波与同波、free优先、3^33安全与3^34溢出、非法/最大计数、phase/非空/余额/ID封顶、重复计算不改状态或RNG；定向strict TS与范围diff通过。首次整仓tsc只见根runtime新luck尚未独立claim分支的暂态索引错误，已告根且没有越界改root。内容与根完整接入验证待收尾，本域不重复全矩阵。

同轮用户再增加采集奖励，根追加gatheringPercent与coinIncomeRemainder契约并持engine/runtime金币入口；构筑Sol独占characters/gear/economy与采集符，本域不争。本域内容作者继续同两个奖励文件加采集六档5/8/10/15/20/25%，说明覆盖怪物金币、清波金币及金币奖励且同类相加；幸运介绍扩为真实金币和装备掉落概率，不承诺稀有率。联合strict曾被构筑域同步增加CharacterBaseStats.gatheringPercent后characters.ts104 switch未收窄的暂态挡住，Sol已纠正一次提前报过的联合strict结果，不将阻断误归helper实现，也不越界改该文件。

另按根要求只读确认已有掉落接线：engine/index.settleDeaths在enemyKilled后直接grantEnemyLoot，真实gear/supply写入对应registry、更新knowledge并emit lootGranted，非UI假物品。普通gear为8%+总幸运×.001，上限30%；supply独立4%；首次空gear且无gear知识保首件，3boss最低rare/epic/legendary且保gear（gear池空才保supply），每kill最多1gear+1supply。幸运不参与品级权重抽样，金币掉落本身为25%+每幸运点1百分点、上限80%。没有为回答“是否已有”重复写掉落系统。

最终领域源码释放：rewardRefresh.ts/test纯策略6/6，内容randomRewards.ts/test新增luck六档1/2/3/4/6/8、采集六档5/8/10/15/20/25且13/13通过。Sol实际读新增metadata/值、全部grade取值循环、同语义跨grade/value去重、cooldown封顶只排cooldown而保luck/采集、有限池7项和默认seed复现，完成非Sol内容验收。当前联合定向strict唯一阻断仍为构筑域characters.ts104同步新属性switch未完成，已如实告根且不反复跑或越界修；helper独立strict在新属性之前真实通过，不能误报当前整仓已过。根继续刷新原子事务/幂等/存档、金币入口与投影/UI，构筑Sol继续采集stats/economy/符，本域不代宣称这些跨域接线已完成。没有改用户存档、共享契约、依赖、commit或push。

## 百项目录、召唤建筑与高负载（2026-11-04，功能冻结／owned-step配对验证完成）

用户明确授权召唤/建筑进入当前demo，覆盖此前独立feature不合主线限制。复用三个健康native：engine Luna `01a1a240-16cd-7392-be82-9400fc3c5fec` 独占新constructs.ts/test；content Luna `01a1a22f-e838-7703-a5f5-63ec59275bc4` 独占expandedSpells.ts、配方/介绍/monsters及对应tests；原perf Luna `01a1a240-1411-7642-8951-44f5de00abbc` 仅新忽略battle-expansion-perf目录。Sol持effects、projectiles真实origin、waves敌攻构造/保留/regen、damage/targets护甲与来源及construct-integration.test.ts。根持contracts、engine/index、runtime/index、demo与部署，Loadout持arcana/gear/supplies/characters，UI另域；没有动.local/pages-clean-check或提交/推送。独立feature仅只读查设计，未合并旧契约/旧扣血代码。

功能目录新增15法术（9种真实旧机制组合、3召唤、3建筑）、8怪物。48法术、39配方+9基础完整DAG，18怪物（15普通3首领），新怪实际armor 1/3/6和regen 5/12并有不同体型/HP/速度/攻击间隔/移动模式，波28可见全部普通。根最终目录脚本实际为48法术/18奥术/18装备/8道具/18怪物共110，加2个法杖模板共112；初始3×3不在模板目录，不把它或不同品级重复计作新类型。根demo接统一导出，普通奖励目录与已有掉落允许全部新定义可达；root/Loadout新增5道具在loot allowlist已实际纳入，不用类型断言绕过过滤。

ConstructSpec公共契约由根确认落地，手动deployConstruct在准备、奖励和已暂停战斗中可用，坐标0..100任意合法点，不限制角色射程圆；无敌或无伤友也可预部署。自动只召唤、建筑不自动花费。编译power为实际攻击/恢复量，HP/寿命/同源容量来自compiled.construct并不在factory二次缩放；duration≤30s，capacity同源≤8，全场32/percast8，预算可用前缀截断、0容量无事件/不收费。费用由根成功调用后一次扣蓝/金币/冷却。存活构造跨波保HP和TTL，准备/奖励/暂停冻结；失败清理，作弊复活重打该波。敌接触构造时停步优先攻击，不同时打领地，构造死亡不发敌人XP/掉落；已发射弹在构造死亡后继续真实飞行，未发射延迟分支源死取消。

攻击/治疗/护盾复用现有纯模拟与伤害来源，构造有真实HP/移动目标/攻击间隔；近战卫士攻击范围修为3，不能隔26单位砍。轻量constructSpawned与每cast一次spellCast替代携全实体的spawn；TTL constructExpired与敌攻constructDestroyed分开。Sol实际审出并修正Infinity目标查询被nearbyEnemies归0、copies超预算全拒、最后非整50ms寿命丢攻击、巨实体事件克隆、source origin回角色、护甲全挡仍触onHit等问题。armor减免后的正伤才施状态，regen只作用仍活敌且不超maxHP，暂停无恢复。

实际验收：构造模块10/10+strict，内容四suite29/29，卫士范围修正后内容7/7；主Sol真实construct-integration最终7/7涵盖9新攻击+3召唤逐项damage/source、3建筑远点部署/一次费用/命令幂等/跨波、compiled duration/capacity/slow/precision与HP/power完整透传、敌优先打塔不领奖、源死弹续飞仍原角色XP、regen/armor/status。初次两个manual fixture漏knowledge而正确拒绝，补合法已知定义后通过，未放宽runtime。旧actor7/cache5通过。根首轮全仓5个旧目录断言失配，其中4个本域已改为真实目录/解锁配置而保逐种比率/重放/15种非boss击杀XP与loot，定向19/19；根另修preview动态道具目录。根报告部署/catalog4项、真实UI炮台与strict已过，未由本域冒称视觉验收。

性能仍需有效混合证据。作者首稿仅6seed且9.05s失败被Sol拒绝；修成100真实弹、20s全active，但30placement全spark、无area/beam/chain/status，仍不满足多技能原任务，不据此改大缓存。已要求同source混合pierce/splash/chain/beam/field/ring/vortex/onHit/split/double/summon并实际事件断言、真实1full+1events订阅。候选仅根index transition内lazy敌idMap与本域projectiles同cast立即分支复用排序目标，延迟分支重查；只有同source控制、完整状态/事件等价及有界前后时间数据通过才保留。未把无效/窄fixture、减少敌/伤害或DEV数值报作性能改善。

最终混合A/B位于.local/work/battle-expansion-perf-2026-11-04/mixed/，同源仅control恢复根Map前index快照及移除即时target复用，optimized保两小候选。×10合成敌生命在17.55s清波，被20s active门禁拦下而未计作收益；最终×30仅为合成压力预设（生产怪物数值不改），60敌+100真实种子弹、领地50k存活储备、3角色6杖/30装杖44背包、1full+1events，四例均20,000ms全active，1x400/5x80次，结束仍battle/29活敌。不是把清波后noop混入均值，也未减少敌数或伤害伪优化。

主Sol直接读四个最终JSON，same-speed完整stateDigest/eventDigest与所有事件、个人XP、掉落和弹体过期严格一致：共9236事件，5167伤害、935新弹、150链段、44光束、104区域、1161状态、18构造，31真实击杀、8掉落、16弹到期且13弹存活；命中状态/穿透/溅射/field/ring/vortex/split/double/summon均实际活动。1x control mean3.783/p50 3.692/p95 4.721ms，候选4.354/4.040/6.537更慢；5x control7.297/6.663/10.535，候选6.927/6.553/9.344仅小幅快。各条件单例且不一致，未通过性能收益门禁，不能报生产FPS改善或保留额外复杂性。

据根约定，Sol已精确撤projectiles即时target复用几行，保留所有构造物真实origin/来源/弹体存续功能；根owner负责撤index Map候选，不恢复整文件覆盖功能。撤后主Sol构造集成7+原cache碰撞5共12/12通过、范围diff通过。根此前已报告生产build与全仓519/519通过，UI真实炮台任意点部署与资源亦过。三个native作者均健康完成/归档，无模型切换；不再跑矩阵。截至该轮的交付为功能与有效混合等价压力验证，上述两个局部性能候选未获稳定收益而回退；后续owned-step结果见下段，已有上轮通知优化不受影响。所有本域源码/测试释放，用户视觉和PWA/首屏最终验收由根/UI持有，未代宣称已接受。


后续根owner保留的性能改动为owned-step：公开`stepBattle`仍先克隆，`advanceOwnedBattle`与其共用同一推进算法，只让内置`demoContent`运行时推进独占的权威状态，省去引擎入口重复的整状态`structuredClone`；自定义目录继续pure路径。对外getState、checkpoint、通知与回执仍克隆隔离。未重新引入敌id Map或即时projectile目标复用，也未增加第二套模拟或跨tick缓存。

实际JSON证据位于`.local/work/owned-step-perf/results/{pure,owned}/measure-speed{1,5}.json`。复用前述混合fixture，60敌、100真实种子弹、3角色6杖/30装杖44背包和1full+1events订阅，合成敌HP×30、领地50k仅作压力与存活储备；生产数值未改。四例均完整20,000ms且结束仍battle，1x为400次有效tick、5x为80次有效tick。每例9236事件，含5167伤害、935新弹、150链段、44光束、104区域、1161状态和18构造；same-speed的stateDigest及eventDigest均完全相同。

| Node runtime.tick(50)耗时（ms） | pure平均 / p50 / p95 / 最大 | owned平均 / p50 / p95 / 最大 |
| --- | --- | --- |
| 1x（400次） | 3.976 / 3.807 / 5.157 / 8.843 | 3.096 / 2.906 / 4.504 / 9.336 |
| 5x（80次） | 7.198 / 6.781 / 9.616 / 11.998 | 6.032 / 5.735 / 8.060 / 12.433 |

该次配对中平均耗时分别减少22.2%和16.2%，p95分别减少12.7%和16.2%；最大单次耗时没有改善。每条件仅一次运行，结论限定为此Node混合模拟窗口的平均与p95改善；包含实际runtime通知订阅开销，未测浏览器渲染、React、布局或网络，不代表浏览器FPS提升。按根owner决定保留owned-step，源码冻结，不再扩测矩阵。本段更新仅复核已有四份JSON并补文档，没有新测量；整个应用的最终回归与发布由根负责。


订阅数准确性更正：直接核对混合runner只有一次`runtime.subscribe`与一次`runtime.subscribeEvents`，上述本轮混合及owned-step测量均为1full+1events；此前记录的1full+2events为转述误差，非新增测量。根已将runner纳入版本控制为`scripts/measure-combat.mjs`，默认加载仓库`src`、measure模式20秒，输出至`.local/combat-measurement`；可在仓库根目录用`SPEED=1 node --import tsx scripts/measure-combat.mjs`（或`SPEED=5`）复用。早一轮通知优化的独立3full对1full+2events记录不属于本轮混合fixture，保留其原记录。


## 命中与定时载荷组合（2026-11-05，机制交付／内容由根接入）

本轮按根转交的用户授权独立完成，不另派子任务、不提交或推送。独占contracts/index、loadout/compile、engine/effects/projectiles/index与新增trigger-limits、trigger-composition、spellTriggers及其行为测试；经根追加授权，小范围修改areaEffects的可选position/maxCasts入口及grade-scaling的触发兼容。根原有AreaSpec.shower、区域分落点、compile深拷贝和shower范围增幅，以及EnemyStatus.wetRemainingMs均保留。未改targets/statusEffects、内容定义、配方、UI或存档；hit-trigger/timer-trigger内容与说明由根添加。

公共增量为ArcanaDefinition.modifier的hitTrigger/timerTrigger，以及非递归的TriggerPayload、SpellTrigger；CompiledSpell可含trigger或triggeredByItemId，CombatEntity可含trigger、triggerRemainingMs、fixedOrigin，全部是可选字段，旧实体/顶层存档语义不变。hit-trigger建议value=1，timer-trigger的value为模拟毫秒，夹100..2000，品级不改变触发时长。没有依赖浏览器定时器。

有效桥要求一件触发奥术恰好正交邻接两个法术；按placement网格y、x、itemId排序，先者必须是projectile载体，后者必须是projectile或area载荷。触发奥术自身也按网格顺序解析，载体与载荷实例一旦分配就不再参与其他桥；载荷不能再次作载体，深度严格为1。缺邻居、3个以上邻居、先者不是投射物或后者是治疗/护盾/光束/链/构造等不支持类型时均不成桥，原自动施放和原代价保留。旧数值奥术仍各自按原邻接规则修饰载体和载荷；触发编译最后进行，不修改内容定义或权威状态。

调用链为compileWand→composeSpellTriggers生成已修饰的独立载荷快照；stepBattle跳过triggeredByItemId载荷的普通自动施放，等待两item冷却均就绪、法力满足合计后才尝试发射载体。只有载体实际生成成功，才一次扣载体+载荷的manaCost，并将两item冷却同时设为max(两者已修饰cooldown,50ms)。副本不额外收费，载荷触发时不再扣费；未命中、到期、提前碰撞或预算导致载荷未投递不退费。无目标、法力不足、载荷尚在冷却或实体上限发射失败均不产生部分扣费。两item都设置冷却，避免暂停重排后绕过已预付载荷的冷却。

advanceProjectiles沿真实运动线段找首次接触；hit模式在碰撞点释放一次载荷，载体自己的穿透/溅射/伤害照常，不要求伤害穿过护甲（实际接触即触发，飞空不触发），穿透后续接触不会再释放。timer模式从每颗载体实际发射开始计时，连发等待期间不计时；运动片截到到期时刻，在该位置释放并消耗载体，提前或同时接触则先结算碰撞并取消定时载荷。暂停、打开背包或非战斗状态冻结推进。新的载荷投射物只在下一次推进飞行，连发副本也保持触发点为固定发射源；区域载荷无论原anchor配置都从触发点生成，可在附近已无存活目标时正常出现。区域伤害仍由原advanceAreaEffects结算，没有伪造直接扣血。投射物载荷若当时无合法目标则不生成，spellTriggered记录spawned=false。

releaseSpellTrigger复用既有投射物/区域工厂与实际伤害、状态、经验来源路径；伤害sourceItemId为载荷实例，sourceCharacterId为原发射角色。在途快照不再查询当前装备，暂停后移动/卸载物品不改变已发射效果。发射器通过显式函数参数传入，避免projectiles与spellTriggers运行时循环依赖。事件为spellTriggered（载体entityId、角色/载体/载荷item、modifierItemId、mode、真实x/y、spawned）及超预算spellTriggerSuppressed，沿用已有spellCast/projectileSpawned/areaSpawned/damage事件。

有界预算集中在contracts/trigger-limits：载体每cast最多8弹，每颗载体一次释放、载荷最多4实体（含burst×split和shower最终总数），每次固定步推进最多16次释放，超出一次性消耗并记录stepBudget，不积压队列；仍叠加既有512活投射物、32活区域及各类型目标/寿命上限。深度1且类型不含嵌套trigger，编译保留互斥实例；运行时也只复制显式载荷字段，无法从载荷继续生成触发链。无触发奥术时编译立即返回，推进用入口实体数量上限遍历，避免为了新实体隔离再分配整实体数组。

实际验证：新增spell-triggers.test.ts 11/11通过，涵盖网格顺序/原修饰与不可变性；真实命中点冰环伤害且无独立载荷双伤；timer大步精确位置及暂停/背包冻结；提前碰撞取消/护甲挡仍真实接触触发；连发等待不倒计时及载荷固定源；无效桥；合计法力/载荷cooldown/无目标原子失败；在途卸装与pure step冻结；密集8/4/16预算；飞空不触发、穿透仅一次；共享载荷/嵌套禁止。旧compile、advanced-modifiers、projectiles、碰撞与cache、area-effects（含根的shower）及construct-integration合计52/52通过。额外owned-step与projectile-speed连同新机制复核共17/17通过，git diff --check通过。初轮strict被并行内容magicDescriptions新modifier穷举和statusEffects中间状态阻塞；最后复查statusEffects已恢复，仅余根待补magicDescriptions的hitTrigger/timerTrigger，本域无类型错误，最终strict由根接入内容后更新。未跑e2e或视觉验收，最终可获得内容与文案、整仓回归由根持有。

元素反应由 Luna 原生 chat `01a1a240-16cd-7392-be82-9400fc3c5fec` 接入：水系正伤使活敌潮湿1.5秒，后续雷击消耗潮湿并以50%伤害向最近敌人传导一次，无邻居时追加到原目标。Sol 审查发现自定义目录元素来源问题；battle Sol chat `01a1a190-f5e9-73e2-92ef-3468a1accc41` 补充施法、载荷、领域、光束、雷链及构造物的元素快照，旧存档缺字段仍可回查内置目录。Sol 原生 chat `01a1a190-f915-7e63-b995-4fdb7bf581f7` 复审通过，相关23项测试及完整类型检查通过。根接入陨石雨和新增内容；完整构建及回归由根统一执行。

### 法术体系扩展

- GPT-6.1 Sol 在独立法术任务中实现并审查，范围为内容、构筑编译、战斗规则和技能树。通用绘制由性能任务负责。
- 新增 24 个法术、10 个奥术和 32 条配方。新增亡灵元素、限量的战斗遗骸、终点触发和凝聚。遗骸只在当前波次内有效，每个己方召唤物最多重生一次。元素奥术按实际接触格计算，融合元素平均分配加成。
- 公共契约新增可选遗骸、召唤数量、元素加成和配对施法字段。既有存档可缺省这些字段。内容经现有奖励、发现、配方事务和技能树接入。
- 本地运行用 `npm run dev`。实际验证包括生产构建、642 项测试及 `git diff --check`。测试覆盖新增配方可排布、横竖配方、元素加减成、终点释放、凝聚、复生、尸爆和重生。浏览器内的视觉效果与数值体感尚待试玩确认。

### 已确认的进阶路线与 1024 目录草案（2026-11-06）

| 任务 | 独立对话（GPT-6.1 Sol） | 文件所有权 |
| --- | --- | --- |
| 第一批火、水、雷 | `01a1add5-a41b-7cc1-8f23-95f477ccfa61` | `approved-1.ts` 内容及图标、元素行为测试 |
| 第一批金、木、土 | `01a1add5-a785-7ff1-9efa-de6fe1830504` | `approved-2.ts` 内容及图标 |
| 第一批风、光、暗、亡灵 | `01a1add5-ab91-7611-ad52-1968cb3200a9` | `approved-3.ts` 内容及图标 |
| 第一批奥术 | `01a1add5-af2e-7401-8350-8bc43373c838` | `approved-4.ts` 内容及图标、战斗与法杖编译接线、奥术测试 |
| 第二批元素 | `01a1adde-8352-7be2-8440-529414931a18` | `approved-5.ts` 内容及图标 |
| 第二批奥术 | `01a1adde-8022-7a20-b783-bb6f42096764` | `approved-6.ts` 内容及图标、独立机制及第一批完成后移交的公共接线 |
| 1024 草案分组 | `01a1adde-862f-7232-8102-aa73a3e9c55c`、`01a1adde-8934-7253-b554-49da9b9dccce`、`01a1adde-8c43-7981-9c6f-39a112a56b68` | 火至土、雷至亡灵和奥术三个内部核对稿 |

游戏目录基线 120 法术、41 奥术。第一批确认 73 法术、16 奥术；第二批确认 37 法术、28 奥术。初稿的 709 个候选经分系质量复审，保留 151 个（五系 60、另五系 51、奥术 40）。运行目录 315 项与候选相加为 466 项，离 1024 的目标还差 558 项。用户审阅稿在 [新增路线](../design/spell-catalog-proposed.md)，只列新增候选链。其余目录草稿保留已存在的依赖锚点与临时 ID。草案未进入运行目录，候选完整配方、数值和性能待设计确认。

模块负责人统一注册目录、配方和图标，并把过低阶的旧配方改为需要真正的中阶材料。保留原配方 ID 和旧法术 ID；读旧存档时保留背包、法杖、波次和发现记录。战场可复用目录图标作为新增构筑物的表现。已有技能按 `npm run dev` 运行；配方预览使用相同的占格、方向与邻接规则，可从技能树查看。

负责人复核实际结果：新 154 项均有技能树节点和图标。273 条配方由技能树预览生成格形，经实际法杖选项和合成事务逐条通过。664 项测试、生产构建和 `git diff --check` 通过。现有实例的读档覆盖贫铀弹旧配方已发现的情况。新奥术的触发、领域、弹道和召唤组合均复用现有绘制，添加有限生命周期与触发预算。尚未完成实机长局平衡或视觉验收。运行变更交根任务合入发布，草案供单独审阅。

下一轮仅深化设计。151 个候选增至 197 个，奥术 40→55，元素 111→142，十个元素各深化一条主线与支路。315 个运行定义加候选为 512，离 1024 还差 512。核对了候选与现有 ID、名称、祖先的连通性。现有布局匹配器验证 34 个奥术材料见证，以及横竖邻接和双分支汇合的代表格形；候选形状暂定，正式配方与规则未实现。破盾线依赖敌方护盾，资源和延迟载荷依赖明确的预算及取消规则。
