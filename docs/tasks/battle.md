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
