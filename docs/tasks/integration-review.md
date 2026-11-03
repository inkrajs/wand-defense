# 根运行时集成 Sol 审查

审查者：独立 GPT-6.1 Sol；日期：2026-11-03。仅拥有本记录，未修改代码或其他任务文件。
状态：根运行时集成 Sol 验收通过（代码与定向调用）；初审两项 P2 已按当前代码复核关闭。协议负责人现已完成 broker/connection 独立 Sol 验收，证据见 protocol.md；本审查不重复替代该模块验收。

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

以上为初轮验收边界。最新状态：协议模块现已独立 Sol 通过，见 `docs/tasks/protocol.md` 的实际调用流与验证记录，本审查未重复其测试。

## 修正后复核

- 实读当前 main.tsx：已删除 pagehide 的永久 dispose，close 仅用于 HMR dispose。缓存页面不再经此入口销毁 runtime/计时器，原失效路径消除；本次为代码复核，未声称运行过浏览器历史恢复场景。
- 实读 runtime/index.ts、mock.ts、initial.ts：生产状态来自独立 initial，mock 仅复用该工厂，无生产依赖 mock。
- 同步发现协议负责人已修正 projectContent：已知配方返回已知输入、unknownInputCount 与邻接条件；未知产物 ID/定义不返回。内联断言实测初始 fireball-recipe 包含 spark/amplify、requireAdjacency=true，output 字段不存在，fireball 仍未成为已知法术；发现与隐私同时保持。
- 实际运行 `node --import tsx --test src/agent/projection.test.ts`：2/2 通过。
- 本轮不重复 engine/loadout/UI 模块验收；connection 未完成不算根 runtime 逻辑缺陷，也未把 HTTP 最终集成标为通过。订阅重入已专项复核关闭；缓存保留与配置注入保持后续优化项。其他验收结论保持不变。

## 全屏游戏结构接线专项复核

结论：本次 main/AgentConnection 结构集成通过代码审查，未发现新增阻塞问题。

- 实读当前 main.tsx、AgentConnection.tsx，以及 App 的 agentPanel 类型与挂载位置：main 只渲染一个 App，把 AgentConnection 作为 ReactNode 注入；App 在游戏 main 内的设置面板挂载该节点，不再在游戏根节点外并列追加连接面板。
- runtime、content 仍使用模块级同一实例；没有新增模拟、timer、连接对象或命令路由。agentPanel 始终位于相同树位置，原生 details 展开/折叠不条件卸载 AgentConnection，App 的战斗状态更新也不会重建连接 effect。
- AgentConnection 外层改为带 aria-label 的 section，移除原页面级 details/maxWidth/margin/padding；连接按钮采用已在应用使用的 Inkra Button，原点击切换 connected 逻辑不变。effect 的 connected/runtime/content 依赖、创建连接参数、onSession/onStatus 与 cleanup close 保持原流程；没有向 UI 暴露 browserToken。
- 本次仅静态结构与调用流复核，未运行全套测试、未截图或评图。撑满 viewport 的实际布局与视觉由用户确认，UI 局部实现由原 UI reviewer 验收。其他根集成结论保持。

## 当前 main 领域变化专项复核

结论：本批根集成代码与定向调用复核通过，未发现新增阻塞问题。以下以最新产品调整为准，覆盖前文旧范围/门禁描述；不将旧 demo 的召唤/建筑交付目标套用到当前 main。

- 当前 demoContent 法术为 spark/fireball/regrowth/metal-needle，initial 仅 spark 与 amplify。实际检查 runtime 的清波奖励轮换、升级赠品、招募赠品均引用现存定义，知识初始项无 wolf/tower/spirit。engine 主循环没有召唤推进调用。用户指定的独立 feature 分支由原 battle Sol 交付，本审查未切分支、未合并或重复验收该分支；UI 静态表现映射里的旧图标不构成可获得游戏内容。
- progression.ts 集中累计阈值 `level*(level+1)*10`；engine 的 while 升级与 Battlefield 的经验环均引用同一模块，环显示累计 XP 扣本级下限后的进度。实际断言 XP25/level2 为 5/40，XP20/level2 为 0/40，累计60在 engine 从level1跨至level3，未改变累计XP的语义或重复另建UI规则。
- territory 的 shield/maxShield 为可选字段，initial 为50/50。waves 先计算 shieldAbsorbed，再扣溢出 hpDamage，HP 下限为0；engine 检查HP归零失败。旧状态缺少盾字段时按0盾受伤。现有恢复奖励、治疗和作弊heal仍只恢复HP，没有隐含回盾。projectState 的 territory 副本包含盾字段；projectEvents 数字白名单覆盖 shieldAbsorbed/hpDamage/territoryShield，远程能解释一次伤害的拆分。
- loadout 先拒绝 defeat，再仅对 battle&&!paused 拒绝；因此 ready/reward 可无背包直接编辑，battle暂停可直接编辑，战斗运行仍不可编辑。四种构筑命令共用这道门禁，原几何、原子事务、冷却与幂等流程未复制或绕过。背包打开强制暂停/关闭恢复先前暂停逻辑继续有效，inline 编排无需打开背包属于本次授权规则调整。
- AgentConnection 仅将展示文字换 PencilText，effect、依赖、连接参数、权限信息与按钮业务保持不变；未审视觉表现。UI 大改及 WandBoard 等新增组件由原 UI Sol 单独验收，本次不扩张到该范围。

实际独立定向执行（node --import tsx 内联断言，无新增源测试文件）：ready place成功；battle运行 remove拒绝；battle暂停 remove成功；reward place成功、defeat place拒绝；50盾受30后为20盾/100HP，再受30后为0盾/90HP；stepBattle 不改输入；无盾旧状态受30后为70HP；投影伤害字段为20吸收/10HP伤害/0余盾；XP边界、跨级与初始定义完整性均通过。未运行全套测试、未截图或视觉验收；其余既有验收结论保持。

## 刷新恢复与显式重来专项复核

结论：本批根领域接线 Sol 验收通过，未发现新增阻塞问题。实际阅读 contracts 的 restart 命令、runtime 的 RuntimeCheckpoint/恢复/restart、session.ts、两项 session.test.ts、main 的存储生命周期，以及 agent parser/capabilities/events 接线；未改上述代码。

- main 在创建唯一 runtime 前从当前标签页 sessionStorage 读取 checkpoint，恢复的是同一份 GameState 和内部控制状态，没有启动第二份模拟。subscribe 自动保存：非battle或有语义事件立即保存，battle无事件按500ms节流；pagehide 无条件保存当前精确状态，不清timer/不dispose，保留BFCache恢复路径。HMR close 保存后移除旧监听、unsubscribe、清timer并dispose旧实例。
- checkpoint 对 state、pausedBeforeBackpack、results 完整克隆；恢复再克隆并重建 Map。恢复不走 restart，不清金币/XP/布局/波次/实体/奖励/知识/作弊；同时保留伪随机状态与冷却，关背包能还原原先手动暂停，重试已成功或失败的 command.id 都返回原回执。仅保存公开 snapshot 无法做到的两项内部数据，本次已覆盖。
- restart 在现有 runtime 内用 createInitialState 重置玩法，生成新run id，重置背包前暂停状态；保留此前revision与nextEventSeq后发 game.restarted 并提交一次新revision。旧玩法事件清空但序号不回退。results不清空，restart回执在通知与自动保存前入缓存；同id重试（包括刷新后）不重来第二次。旧命令回执保留也是有意防止传输重试重放，后续新命令仍应使用新唯一ID。
- agent parser、remoteCommandTypes、commandSchemas 同时包含 restart；game.restarted 与 gameId 白名单一致，事件可指向新run，state.id也随之更新。保存checkpoint不经过普通协议投影，未把随机状态或内部回执存储对象公开给Agent。
- session.ts 使用固定键与checkpointVersion/schemaVersion检查，拒绝破损JSON、不支持版本与不符合基础结构的载入；读取、写入和访问sessionStorage异常不导致游戏崩溃。范围为当前标签页刷新恢复，不是账号存档。storage禁用或配额耗尽时saveRun返回false、游戏仍在内存继续，届时刷新持久性不保证；当前实现没有UI保存失败提示，此为明确运行边界，不将失败写入称为成功存档。校验是当前自产checkpoint的基础结构保护，不是任意外部存档导入器。

实际验证：独立运行 `node --import tsx --test src/runtime/session.test.ts`，2/2通过（进行中波次/布局/回执/暂停恢复与清波后下一波；重来重置、游标、幂等与新局持久化）。另用内联断言验证checkpoint参数隔离、失败命令回执恢复、原先手动暂停为true时关背包保持暂停、远程restart和公开事件gameId、seq精确衔接与revision+1、重来回执刷新后再重试、旧/未来checkpointVersion拒绝、写入异常返回false，均通过。未运行全仓测试、未实际浏览器刷新/BFCache/受限storage评测，未截图或评图。UI菜单入口由原UI Sol另审，其他验收结论保持。

## 法杖空归属与游戏倍速专项复核

结论：本批根集成 Sol 验收通过，未发现新增阻塞问题。只读 contracts、runtime、agent 接线，以及 compileWand/engine 的归属消费点；loadout equipment 内部由原负责人 Sol 验收，不重复其全套测试。未读改 icon-buttons.css 或其他 UI 工作文件。

- WandInstance.characterId 明确为 Id|null，null代表未装备；runtime 将 unequipWand 与其他构筑命令统一交 loadout，继续复用事务门禁和结果幂等。额外法杖奖励创建null归属、不自动占角色槽，角色招募所带法杖仍双向归属。engine 要求characterId与角色wandIds匹配才施法，compileWand 对null直接返回undefined，未装备法杖不参与战斗。
- agent unequipWand 的解析校验wandId，白名单命令与schema均已加入；投影保留characterId:null，wandUnequipped与原装备事件均可订阅。equipWand 仍要求有效角色ID，不能用null伪装卸下绕过显式命令。没有增加第二套装备规则。
- GAME_SPEEDS 为contracts公共允许值，GameSpeed类型、runtime验证与remote parser共用列表；非列表值拒绝，不修改状态。setSpeed只更新速度与speed.changed，不直接推进游戏；state投影、事件数字字段和公开schema均能表达速度。
- runtime tick 先验证有限正数并检查battle/paused/backpackOpen，再用 `Math.min(dtMs,250)*speed` 交原engine分步处理。5倍速最大每次推进1250ms游戏时间，仍按engine至多50ms子步结算；上限是输入墙钟而非缩放后的游戏时间，未把高速误截为250ms。倍速统一影响游戏时间、移动、冷却、法力与波次，不修改HTTP轮询/保存节流的墙钟计时。暂停/背包打开时更改速度不产生战斗推进。
- 初始speed=1；旧checkpoint缺字段或非法值在runtime构造阶段归1，构造时已克隆checkpoint，未污染原存档。session版本不变可读取旧存档；合法倍速保留，restart通过initial归1。新命令继续走统一results缓存与checkpoint，未增加模拟或独立timer。

实际验证：独立执行 `node --import tsx --test src/runtime/speed.test.ts`，2/2通过，覆盖全部允许倍速、准备不推进、暂停、恢复与重来、非法输入和公开协议。另内联断言验证远程卸下/重新装备、null归属状态及事件/能力投影、equip null拒绝、领取wand奖励不占槽、旧JSON存档缺speed恢复1、非法恢复值归1、tick(10000)在5倍仅推进1250ms、背包打开后改为0.25倍仍冻结，均通过。未运行全仓测试或视觉验收；其他结论保持。

## 命中特效与显式开发赠送专项复核

结论：本批 Sol 验收通过。命中坐标、纯表现与赠送领域逻辑通过；本轮 DEV HMR 清理 P2 已由根修正并局部复核关闭。仅修改本记录，发现问题时已先通知根。

- engine/effects.ts 的damage/heal新增坐标数据，没有把命中移到表现组件；projectile仍即时扣血、heal仍只按实际缺失HP恢复。死亡清理后事件仍有命中位置，旧事件缺坐标仅在目标仍存在时可回退。
- 最新实现将注册表/collectCastVisuals抽到无React/CSS依赖的combatVisuals.ts。只按新seq读取已发生damage/heal，限定已映射法术/有效来源/正amount/有限坐标；不修改状态。CombatEffects初次挂载以nextEventSeq-1起始，换run清旧并同步游标，暂停时消费游标并清动画；至多32条，按performance.now与expiry清理，effect清timeout。只读GameState，不持有RuntimePort，不派发伤害/扣蓝/命令。CSS为pointer-events:none和aria-hidden表现层，系统及游戏reduced-motion均关闭飞行并用短暂静态淡出；视觉效果仍由用户确认。
- grantItem复用giveItem覆盖spell/arcana，grantSpell仍限定spell；两者均须本地解锁且启用，普通HTTP不能unlockCheats。grantPreviewMagic通过原dispatch解锁、开启、按requestId与definitionId生成唯一命令、赠送并开背包；不创建新run或推进时间，相同请求重试不重复加物品。正常initial没有赠送，main仅DEV+hot注册通路，Vite插件仅serve且显式env启用，生产无该触发入口；main本来就是浏览器入口，本次未新增SSR用途。
- 初审发现Vite对每个ready都投递，跨标签页并非一次；根已修为recipient锁首client，completed仅在匹配client/requestId ACK后置位。独立mock配置回调验证其他client不收、错误client/nonce ACK不结束、正确ACK后全部ready不再发，均通过。未连接真实浏览器或socket、未重新发送用户赠送。根报告真实前台ACK granted8/definitions8、run未改变；该真实ACK由根取得，本审查未冒充独立取得。实际确认.env.local不存在。

**[P2，已修正复核关闭] main两次hot.dispose互相覆盖。** 原代码先`hot.dispose(close)`，DEV分支又`hot.dispose(()=>hot.off(...))`。独立读取当前安装Vite的`node_modules/vite/dist/client/client.mjs:513`，dispose(cb)实现是`disposeMap.set(ownerPath,cb)`，并非累计。因此后注册回调覆盖close：旧timer、存储订阅、pagehide监听及runtime不清理，runtimeActive仍为true，异步import也可能继续操作旧实例。通知根后已实读最新main：只注册一个`hot.dispose(close)`，close先置runtimeActive=false、执行detachPreview注销指定grant监听，再保存和移除旧订阅/计时器/dispose。异步import恢复时检查runtimeActive，不能再给旧实例赠送或ACK。局部代码复核通过，未声称真实浏览器HMR运行验证。

实际运行preview.test.ts与combat-visuals.test.ts，2/2通过（包括同帧死亡目标移除后的命中坐标与seq过滤）。另内联验证heal坐标50/84与实际18恢复量、heal视觉映射、已消费seq/非法坐标不播放，通过。最初临时转译TSX的验证脚本因本地TypeScript不提供预期transpileModule API失败，未作为产品缺陷；随后直接复用已抽离纯模块验证成功。未运行全套、截图或AI视觉评审。

## 准备阶段开始时自动收包专项复核

结论：最新runtime startWave差异 Sol 复核通过。实际读取当前实现：先验证phase=ready且HP>0，失败时不触碰任何状态；成功按需记录backpack.changed/pause.changed，清backpackOpen/paused/pausedBeforeBackpack，再调用既有startBattle，最终仅统一notify一次。手动暂停和打开背包不会再阻止玩家明确开始，后续开关背包不会恢复开始前旧暂停；reward/defeat仍无法绕过领取或失败状态。普通暂停/背包的原有恢复逻辑保持。

独立实际运行最新session.test.ts，3/3通过，包含新增准备收包闭环。额外内联断言验证：监听器仅收到一次最终battle/closed/unpaused快照，事件顺序为backpack.changed→pause.changed→waveStarted，同id重复start不变；reward、defeat、ready但HP0的start均拒绝且状态完全不变。未评UI按钮显示或位置，未运行全套。前节HMR单一dispose问题已关闭，其他验收结论保持。

## 本地 Inkra 包切换专项复核

状态：本批Sol验收通过。公开包消费与Vite去重配置审查通过；以下两项初审P2已修正并经隔离临时目录复核关闭。本次仅读消费者脚本/config/package信息与当前库公开manifest/dist路径，不审库内部代码、不改真实链接、不重启预览。

- package scripts调用独立可逆脚本，registry原包移至.local备份，.gitignore忽略.local，依赖仍固定registry版本，无机器本地路径写入package-lock的实现。切换目标为整个built package，保留原public exports解析，而非绕过导出直接alias库src。
- 实际扫描消费者src的全部Inkra导入：根包、display、inventory-grid、radar、resizable、styles.css；对应当前linked公开manifest导出均存在，指向dist的JS/types/CSS文件均实际存在，顶层types与根exports.types一致，React/ReactDOM为>=18 peers。此为当前目标与当前消费面的验证，脚本本身仅校验根index.js/index.d.ts，不是完整发布包验证器。
- Vite resolve.dedupe包含react/react-dom，避免链接库沿自身路径加载另一份React；仅检测symlink时exclude @inkra/react预打包，并把消费者root与本地库上两级root加入fs allow，以读取公开dist及其依赖。没有设置preserveSymlinks或导入库私有src。实际多React运行场景由根联调，本次未声称浏览器运行验证。

**[P2，已关闭] 悬空managed link无法恢复registry。** 原registry及切换现有local分支用realpathSync(installed)核对marker；owner的临时built目录被删除或移动后，该调用ENOENT，即使备份完整仍不能恢复。独立隔离fixture确认local成功后删target，原registry退出1，registry备份仍完整。现改为readlinkSync词法目标结合dirname(installed)进行resolve后对照marker，删除target后registry恢复成功，继续拒绝外部改动/非管理链接。

**[P2，已关闭] 允许安装目录自身作为local目标会生成悬空链接。** 原local先realpath目标和验证manifest，再rename安装目录到backup；若传node_modules/@inkra/react自身，目标同时消失，随后创建指向原安装位置的自引用/悬空link却退出0。独立fixture确认原exit0、installed为symlink但package.json不可读取。现对canonical目标在任何移动前拒绝target等于或位于installed/backup之内；临时fixture确认安装目录自身与backup目标均拒绝且原状态可恢复。

实际验证：`node --check scripts/inkra-local.mjs`通过；在审查聊天自己的work临时目录复制脚本并创建mock registry/built包，验证正常local→同目标重复local→registry通过，上述两个P2实际复现。只用spawn执行临时副本，未执行真实npm切换、未打开页面；fixture已全部删除。问题已先通知根协调者，其他既有领域验收结论保持。

修正后独立复核：重新复制最新脚本至隔离work fixture执行正常切换/同目标重复/registry往返、删除target后的悬空链接恢复、self/backup目标变更前拒绝、外部替换链接被拒且保留完整backup，均通过。实读失败回滚：重定向保存previousTarget，创建新链接失败先还原旧链接，首次失败还原registry；该异常注入分支本次未运行。Vite新增INKRA_LOCAL define为JSON布尔值，仅表达消费方式，不是运行时别名；dedupe与公开dist消费保持。独立`git diff --numstat -- package-lock.json`无输出。根报告真实link+tsc通过及CSS已从/@fs/.../dist/styles.css加载，该浏览器/服务证据由根取得，本审查未重复或冒称独立验证。所有临时fixture已删除，真实链接/预览未改。

## 四选一奖励与全队攻击加成专项复核

结论：本批根领域Sol验收通过，当前demo未发现新增阻塞。实际读取最新AGENTS（包括禁止默认可见操作提示基线）、contracts、content/rewards.ts、runtime领取/生成、compileWand、公开投影与rewards/session测试；未修改或验收UI奖励卡工作文件。

- Grade新增mythic；RewardOption的品级/说明/详情/结构化effect为可选，旧奖励可继续领取，旧角色/法杖奖励缺grade默认common。runBonuses可选，编译和投影都以缺失attackPercent为0，旧checkpoint无需抛弃或另建模拟。
- createWaveRewards纯工厂集中四选一配置：buff/item/heal，以及character或wand或coins，当前有效catalog各波均4项；六档10/15/20/30/40/50与每3波升级、16波进入mythic一致，属于原型平衡而非最终规则。治疗说明35HP且不回盾符合实际，法杖说明未装备符合null归属；当前物品定义全部common/level1，与giveItem的现有实例创建一致。giveItem尚固定common/level1，若后续catalog物品定义升级品级/等级，应同时使创建值跟随定义，不能只改卡片metadata；此为现有demo范围的扩展约束。
- prepare统一调用工厂，再仅发现实际offered物品；未因新增六档或buff公开全catalog。公开rewards沿既有已知definition过滤，未知项不复制隐藏description/details；已展示选项详情可见。runBonuses投影显式只返回attackPercent，不扩张普通接口的内部状态。
- claim buff在任何修改前要求effect.type=attackPercent、value有限且(0,100]，失败保留整组选项与状态；成功累加百分比、清选项并phase=ready，一次revision/事件/统一通知。同command.id命中既有结果缓存，不同id重领因phase不符拒绝，重启通过initial清除bonus，刷新保留bonus和回执。
- compileWand在奥术和序列后仅对projectile乘(1+累计百分比/100)，不再次修改mana、copies或治疗power。engine继续消费该编译power一次，未建立UI/HTTP数值规则副本。角色/备用杖按各自reward.grade创建，备用杖null且不自动占角色装备槽；物品进共享背包。
- 本批领域层仅结构化数据、命令结果与事件，不主动增加可见成功/失败提示；用户新基线已读取。实际卡片交互、sr-only与无默认可见提示由UI负责人另审，本审查不越界声称完成UI验收。

实际独立运行 `node --import tsx --test src/runtime/rewards.test.ts src/runtime/session.test.ts`，6/6通过。另内联断言验证旧状态无runBonuses按0、10%+15%相加为25%、真实engine中含10%序列的火花造成13.75伤害、不同id重复claim不变、0/负数/>100/NaN/Infinity buff拒绝且状态不变、当前catalog第1至20波均4选项，通过。未全仓测试、未截图/视觉评审，其他验收结论保持。

## 敌人加速与特效分段专项复核

结论：本批Sol窄复核通过，未发现新增阻塞。只读本次contracts、waves/movement测试、公开运动投影、CombatEffects及CSS，未改UI负责人文件或评图。

- CombatEntity保留speed为上限，新增可选moveSpeed/moveRampMs；新怪初速为cap×0.18，普通tau1200ms/Boss1800ms。advanceEnemies先检查phase/pause/backpack/dt，才更新速度与位置；引擎继续统一固定子步，倍速仍作用游戏dt，UI没有第二份运动模拟。
- 公式为response=-expm1(-dt/tau)，末速current+(cap-current)×response，路程cap×dt-(cap-current)×tau×response；属于该指数速度模型的解析积分，不用末速直接乘dt。current限制在[0,cap]，位移不超过剩余距离，位置限制在场地；tau<=0即时cap。旧存档缺moveSpeed按cap，保持原匀速，无需清存档。cap/current/tau的NaN/Infinity采用有限默认；已到目标处不再移动，攻击结算与伤害规则保持原流程。
- 投影显式公开speed/moveSpeed以解释当前实体运动，不公开内部随机状态，checkpoint仍完整保留加速状态；暂停和背包冻结当前速度而非仅冻结画面。
- 特效将有限总时长拆为62%飞行+38%命中；飞行ease-in，命中带飞行时长delay并ease-out，治疗仍单独完整时长，无飞行。heading默认0deg，只有@supports检测atan2旋转时按目标与源坐标向量计算，支持性不足保留fallback；CSS语法与量纲调用经代码检查，未声称浏览器实际布局/方向表现验收。旧seq游标、32上限、expiry清理和reduced-motion无飞行保持。表现层仍不派发命中或修改伤害。
- 实读giveItem已用definition.level/definition.grade，前轮固定common/1的扩展约束已解除，当前demo实例值不变。

实际独立运行 `node --import tsx --test src/engine/movement.test.ts src/engine/index.test.ts`，11/11通过（加速单调/cap、批次一致、旧存档、pause/backpack及原战斗用例）。另内联断言覆盖ready/reward/defeat完整冻结、speed/moveSpeed/moveRampMs各NaN/±Infinity回退后位置/速度有限、普通/Boss各tau与首步速度范围、投影moveSpeed一致；以PostCSS解析当前CSS无语法错误，并核对所有允许倍速下总时长与62%+38%子时长有限且总和一致，通过。PostCSS解析不等于浏览器CSS支持或视觉验收；未全仓测试、未截图，其余结论保持。

## 真实弹体表现与合成协议接线专项复核

状态：本批根适配Sol验收通过；projectileVisual目标坐标NaN回退P2已修正并复核关闭。仅审根适配；engine真实弹体/每波mana与loadout合成品级事务已有原负责人Sol验收，本次未重跑其领域全套。

- CombatEffects只渲染state中现存projectile实体位置，不创建模拟计时器/移动/伤害；CSS只50ms left/top补间，暂停禁用补间。source/origin/target快照用于角色UI起点显示校正，剩余路程权重归零后回到权威终点，不写回runtime。Battlefield普通实体层已过滤projectile，避免双重绘制。
- damage/heal/projectileExpired仅生成impact/治疗/消散，旧事后CSS飞行已移除。初次挂载/新run不重播旧事件、32条上限、expiry timeout cleanup、暂停清表现/消费seq沿用；projectile实体随权威state移除，非battle不渲染。reduced-motion去位置补间与尾迹，保留当前权威位置与短暂静态消散，不另调度命中。UI token对接未改，不评实际像素或视觉表现。
- 新mergeItems由公共Command→parser白名单→dispatchRemote→唯一runtime统一路由到原loadout事务，字段仅sourceItemId/targetItemId，能力schema一致。沿既有results/cache/notify，未复制另一套合成规则。独立真实runtime适配验证一次成功、同id重试状态不变，额外私有字段被解析移除、非法ID拒绝。
- 现实体投影显式增加source/origin/target实例信息与坐标，definitionId仍须已知；事件增加projectileSpawned/projectileExpired/itemsMerged，只允许列出的数字、实例ID及已知定义字段。grade现按gradeOrder具体六档枚举筛选，任意字符串/内部payload不透出。窄验证unknown定义、任意grade、internal字符串及NaN/Infinity事件坐标不公开，而mythic合法可见。没有借新接口公开整个catalog或内部damage模拟字段。

**[P2，已关闭] projectileVisual未校验targetX/targetY有限。** 原target使用`??`，NaN不会走fallback；独立调用targetX=NaN实测返回targetX非有限。通知根后已实读最新coordinate helper：目标/原点非有限时用有限fallback，所有坐标先限制0..100，故hypot有限；originWeight限制0..1，显示位置再夹紧到敌人显示边界。x/y本身非有限则不渲染。新增NaN/±Infinity/1e308目标与原点用例已独立执行通过，P2关闭，未改代码。

实际运行 `node --import tsx --test src/ui/combat-visuals.test.ts src/agent/projection.test.ts`，3/3通过，包括首tick不播放impact、弹体命中后目标死亡位置、seq抑制及原知识/权限测试。额外内联验证mergeItems路由/幂等/字段隔离、新projectile投影隐私、grade枚举及非有限事件过滤；PostCSS解析通过且不再含magic-flight keyframes。未运行全仓或已验收领域全套，未截图/AI视觉评审。

修正后独立重新执行同两份窄测试，4/4通过（增加非有限/巨大坐标回退用例）。实读reason新增投影仅在typeof string且timeout/targetLost/invalidPosition三枚举时公开，grade仍严格六枚举，没有任意内部字符串通道。根的merge-integration装杖品级提升验证由根取得，本次只复用其领域验收边界，不冒充独立执行。其他既有结论保持。

## 水雷风土弹体外观映射简短批审

结论：本批Sol代码审查通过，无新增问题。仅读combatVisuals.ts、CombatEffects.css、combat-visuals.test.ts，未改UI、未截图或评图。

- 四新定义通过现有注册表映射water/lightning/wind/rock，launch与contact均复用同一映射；没有把元素判断、命中或伤害规则移入UI。原火花/火球/金针/治疗映射、有限坐标防护和seq过滤未改。新增视觉只需扩展kind/registry/CSS，继续消费权威实体与事件。
- CSS每种均有独立颜色、bolt造型与impact规则。水覆盖蓝色光晕、改水滴高光并隐藏原火星b；雷/风隐藏before/i/b并以各自clip-path和渐变造型；岩隐藏火焰尾部/b、替换岩块纹理高光。新元素没有直接继承橙色火星或火焰光晕；公共位置/朝向/50ms补间沿用。fizzled规则位于后且选择器优先级更高，仍能覆盖新impact；reduced-motion通用规则保持生效。
- 新测试用四个真实定义启动engine：首tick有对应projectile、消耗mana但未损目标且无impact；后续实际contact后仅一个对应kind的非fizzle impact，未把纯外观测试误当作四定义领域验收。

实际独立只运行combat-visuals.test.ts，3/3通过；PostCSS解析当前CSS，并定向断言四类均覆盖bolt/impact且抑制继承火星，通过。未重跑全仓或typecheck，未重复battle负责人对四定义的验收；其他结论保持。

## 开发赠送仅补缺失定义增量短审

结论：Sol短审通过，无新增问题。仅读preview.ts、preview.test.ts、vite.config.ts、main.tsx本次增量。

- onlyMissing默认false，旧全赠模式保持；true时从赠送前全部owned item instances取definitionId集合，装备中物品也计入，过滤spell/arcana目录，仅给当前未持有定义。过滤不依赖knowledge，不误把曾发现但已合成消耗的物品视为仍持有。
- 原requestId派生命令ID及runtime回执幂等不变；granted改以after.items相对before.items的新实例ID数计数，重复回执不再误报新增。definitions为本次过滤后候选数，重试时可为0。原局ID/装备/既有物品/波次不重置，仍通过原dispatch解锁、赠送、开包并暂停。
- Vite仅当显式请求ID存在时启用原DEV通道，MISSING_ONLY仅严格字符串1才为true，payload与main默认false转发一致；没有把开关加到普通HTTP，原recipient/ACK停止、runtimeActive和单一dispose清理保持。
- 独立执行preview.test.ts，2/2通过（默认全赠按catalog长度、缺失补全/原items与装备保留、同请求重复新增0且状态不变）。实际确认.env.local不存在；真实granted4、unchangedRun等ACK由根取得，本审查未连接真实客户端/重新赠送，也不冒充独立ACK验证。未全仓、未改UI或截图，其他结论保持。

## 血迹表现与领地升级接线批审

结论：本批根适配Sol审查通过，无新增阻塞。只读新floorBlood/BloodDecals/CSS/测试及Battlefield接入、contracts/runtime/protocol/projection升级接线；真实死亡metadata与territory纯事务分别由原battle/loadout Sol验收，不重复其领域全套。

- BloodMemory使用nextEventSeq为下一待消费游标，跳过seq<cursor，按权威events顺序处理wash与enemyKilled；新mark由runId/seq/entity实例ID确定并防重。damage在kill前先冲洗已有血迹，新尸体不会错误重播前一水击；kill在water前时新血迹参与冲洗，水杀初始washed=.4是独立表现策略。重复快照返回原memory，不重复冲洗；新run或游标回退重建，不把旧局血迹带入。
- 纯表现函数只读事件，强度影响颜色/直径/透明度/时效；火花火球焦黑、岩石扩散、水击局部冲洗与强血迹抗冲洗均在此层计算，不调整伤害/奖励。几何seed只由mark.id散列并用局部PRNG生成，不消耗游戏rngState。live与restore均cap96，恢复只取最后96条、字段重建及数值夹紧、ID/effect限长，不保留任意存储字段；破损/不匹配run cache丢弃。游戏时钟+波次侵蚀，暂停不继续侵蚀。
- BloodDecals初始读可选session cache并消费事件；更新effect仅依赖runId/nextSeq/半秒clock/wave，自身setMemory不改变这些依赖，且纯函数无变化返回同对象，无无限更新循环。保存effect依赖runId/marks，cursor独自前进不必反复写磁盘：未新增/冲洗的事件重扫不影响已有marks。sessionStorage异常只丢装饰缓存，血迹不参与玩法。新局渲染即隐藏旧memory再更新；无额外interval/订阅需清理。memo与按id稳定几何复用，装饰层aria-hidden/pointer-events:none/forced-colors隐藏，未评视觉。
- CombatEntity level/grade及territory等级字段可选，旧存档兼容，initial明确等级1。upgradeTerritory经parser的wall/shield枚举进入原applyTerritoryUpgrade，结果仍先入统一receipt缓存再notify，checkpoint完整保留；没有另一套升级规则。
- 投影仅返回实体有限level与合法grade；territoryUpgraded事件cost/increase/level走有限数字白名单，track只wall/shield，能力schema一致。新增字段无任意内部字符串通道。旧territory等级缺省交已验收领域策略解释，根不另迁移或改写旧局。

实际独立仅运行floor-blood.test.ts，4/4通过。另内联窄验：kill→water冲洗、water→kill不逆序冲洗、重复快照不重放、缓存200条恢复96条/effect限80；真实remote territory命令从缺旧等级checkpoint成功、扣费/上限增长与事件metadata一致、重复id无变化、恢复checkpoint后仍幂等、非法track拒绝/私有字段解析移除及能力投影正确，均通过。BloodDecals.css经PostCSS解析通过。未全仓、未重做领域测试、未改UI或截图；其他结论保持。

最终版本补审通过：live超过96条现按当前opacity×强度系数排序保留，平分时保留较新项，再恢复原绘制顺序；排序只操作新数组，不修改旧memory或玩法。旧厚重boss痕迹不会仅因出生早而被删，淡/弱优先淘汰，资源上限仍96；已实际阅读新增old-epic保留断言。capabilities.territoryUpgrades直接复用同一getTerritoryUpgrade纯函数给wall/shield费用、收益、等级与allowed，不依赖catalog/随机源，不复制价格规则；失败reason是固定枚举。新增territory-integration.test.ts实际阅读确认覆盖remote扣费/保损伤、同id仅通知一次、checkpoint恢复/restart等级重置、费用/收益投影与非法track。根报告最新两文件5/5通过，本轮为最终差异代码复读，未重复执行或冒称独立5/5；原独立窄验结论保持。

## 独立角色经验根接线短审（2026-11-04）

结论：Sol短审通过，无新增阻塞。仅审contracts、initial/recruit、runtime构造/赠品事件消费及projection接线；经验领域规则与UI经验环分别由原battle/UI Sol验收，不重做其全套。

- constructor先克隆checkpoint，再在任何外部snapshot/订阅/战斗前调用normalizeCharacterProgression；迁移不产生升级事件或赠品，不修改调用者存档。legacy shared XP仅迁入首角色；其他缺xp角色按原等级下限保留进度，当前原level1角色为0，不复制共享75。已存在xp不再次迁移，playerLevel明确仅首角色等级alias。initial与新招募均level1/xp0，restart继续走initial。
- tick只消费本次stepBattle返回transition.events中的characterLevelUp，逐级校验characterId/安全整数level后按原轮换发物品并记录character.levelReward，不再比较首角色playerLevel差，也不扫描checkpoint累积events。因此次要角色独立升级同样获赠，历史事件不会刷新重发；giveItem与新事件仍在统一tick通知前完成，checkpoint保存最终state和既有回执。
- flat xp保留累计统计、playerLevel保留首角色alias，同时投影明确experienceMode=perCharacter；每角色显式xp与共用getExperienceProgress结果，level/XP/进度采用同一权威数据。characterLevelUp、character.levelReward及xpCharacterId走事件白名单，未扩张任意内部payload或未知定义披露。

独立仅运行runtime/character-progression.test.ts，3/3通过。另内联窄验构造不改输入checkpoint、battle状态携带旧characterLevelUp后实际tick也不重发赠品、xpCharacterId公开且私有字段剔除、个人进度投影一致，通过。未全仓/视觉验收、未改UI，其他结论保持。

## Beam、新元素与随机奖励根批审（2026-11-04）

结论：本批Sol代码审查通过，无新增阻塞。仅审根表现、编译与奖励组合接线；新战斗/个人XP/死亡metadata、随机抽样策略由原battle/loadout Sol验收，分页/WaveProgress由UI Sol另审，不重做这些领域全套。未动用户浏览器或补发物品。

- BeamEffects只读真实beam固定段/存活时间，实际角色锚点由DOM测量，不派发伤害或使用脉冲timer。useLayoutEffect依赖角色ID集合，先measure，再仅观察容器resize；自身layout状态不会改变容器尺寸，未见循环触发路径，cleanup断开observer。beamVisual拒绝非法/零布局尺寸、无效坐标与过期实体，有限beamWidth夹紧；角色锚点无效拒绝、缺失则用世界坐标fallback。样式只装饰线段、pointer-events:none/aria-hidden，未增加动画命中或操作提示。
- combatVisuals集中扩展15定义，含shieldRestored；chain/pierce已有hitIds时originWeight=0，后段不重新从hero显示发射。thorn/disc/light/shadow的bolt覆盖形状/颜色并隐藏旧火焰子节点；shield为独立恢复impact。旧seq/坐标防护/expiry资源边界保持，BF普通层排除beam/projectile避免双绘。
- floorBlood按真实content.element处理新fire/lightning焦黑、water局部洗、dark色，不另猜定义名称；仍读取实际damage/death，局部确定性血迹PRNG与combat RNG隔离，旧cap/游标/缓存边界保持。
- compileWand将beam纳入攻击百分比，与projectile同样只编译一次；range加成与CD缩减应用真实range/cooldown，CD最大70%。impact/beam结构平铺参数各复制一层足够隔离当前类型，调用方改编译结果不会污染静态content；治疗/护盾未混入攻击增幅。
- reward wrapper仅提供存档rngState闭包给已验收sampleWaveRewards，抽样真实推进同一rngState；fixture默认种子只用于无闭包直接调用。main注入crypto seedSource，只有fresh/restart调用，恢复checkpoint不会重新取种或重抽现有奖励。随机状态及已生成offers一起保存，正常reload保持抽样结果。
- claim五类buff验证type、有限value与(0,100]、当前/累加值有限，CD总值cap70且无实际增长则拒绝；在修改前验证，成功统一提交与幂等缓存。maxMana/regen只在领取时更新真实角色并保留原法力缺口，新招募以基础值+run bonus初始化；constructor不重应用加成，reload不重复增长。item使用offer.grade且校验gradeOrder，实例品级与卡片一致。公开runBonuses显式列出五字段，不暴露随机流/整个catalog。
- 怪物血条改公共Progress，继续使用ratio有限/夹紧值与max100，无显示数字，strokeOptions复用既有材质，本地thin4及registry fallback高度对应；无新玩法规则或可见操作通知。只做代码接入审，不声称视觉已确认。

实际独立仅运行beam-visuals.test.ts与runtime/random-rewards.test.ts，5/5通过。另内联断言验证checkpoint不调用seedSource、未知type/NaN/Infinity/0/>100 buff拒绝状态不变、offer epic确实入实例、beam攻击/range/CD70封顶编译、impact/beam引用隔离、五bonus投影；两份新增/变更表现CSS经PostCSS解析通过。未全仓/重复引擎域/截图或视觉验收；其他结论保持。

## 当前局保留只读核查（2026-11-04）

结论：现有ACK不足以认定用户存档丢失；未发现近期main/session显式自动restart或清键改动。但确认一项既有恢复失败时覆盖原记录的P2数据保留风险，已通知根，未修改实现。当前属性领域仍在开发，本轮不提前全测或验收其规则。

- 实读main、session、preview诊断及diff：近期main改动为fresh/restart seedSource和只读inspection，不更改存储key、checkpoint/schema版本。inspectPreviewInventory仅getState，没有dispatch/save/restart。sessionStorage依标签页与origin分离，独立QA profile/新标签页/不同主机名入口不能直接代表用户页面；初始run id恒为demo，因此多个全新页ACK同demo并不能识别同一局。viewport可辅助区分，但仍宜附只读boot/tab标识、origin与存储读状态，不以现有ACK推断原局丢失。
- 正常full reload的pagehide仅save，无dispose；HMR仅一个close回调，先置inactive/注销DEV监听，再save，随后移除pagehide、取消订阅/计时器并dispose。独立读取当前安装Vite client实现：HMR先调用disposer，之后importUpdatedModule；新静态import模块暂缺会使新entry无法执行，不自行执行fresh/save。旧close已经保存状态，故可使预览暂时不可用，但代码证据不支持“缺模块自动清存档”。若新构造/迁移抛错，也发生在main首个save前，原blob不会由此直接写成新局。
- **[P2，已修复；见后续status API与main复核] 无法区分缺存档与拒读，启动立即覆盖原blob。** 原`session.ts:9-27`将不存在、解析/结构/版本拒绝与getItem异常都返回undefined；原`main.tsx:13,26`因此构造fresh并马上save。如果原键存在但可恢复记录被拒，或getItem暂时失败但setItem成功，原记录会被新demo初始状态覆盖。独立内存storage复现版本拒绝/读取异常两种路径，原wave11原文均被wave0替换。该复现证明风险存在，不证明用户实际走过这条路径。建议读取返回missing/restored/rejected/unavailable分类；键存在但拒读先隔离保留原文，未明确恢复策略前禁止fresh自动写原键，避免诊断过程二次覆盖证据。
- saveRun写失败返回false，但main忽略并更新lastSavedAt，缺乏只读保存诊断；持续受限storage/配额失败可能只保留内存或旧checkpoint。建议记录最后成功保存revision/时间及错误类别用于DEV诊断，不默认增加可见操作提示；遵守用户无默认可见提示基线。未证明本次用户storage失败或配额耗尽。

实际仅内存storage窄验：有效wave11 checkpoint经load→runtime→save仍wave11；未来版本拒绝/模拟getItem异常后同main启动序列会覆盖为wave0；两个新runtime初始id均demo。未触真实sessionStorage、用户IAB、5173页面/profile、inspection recipient或真实赠送，未改main/session/核心/UI；只更新本记录并报告证据与建议。

### 根授权后的最小存储保护修复

本段为后续明确授权范围变化：独占修改`src/runtime/session.ts`与新`src/runtime/session-recovery.test.ts`，未修改main/preview/vite或真实存储。抽取内部parseRun供load/save共用验证，loadRun公开返回保持兼容。saveRun先序列化候选并读原键；原文存在（包括空字符串）但验证拒绝时，先原样保存到`wand-defense:run:recovery:v1`并读回核实，再写新checkpoint。若recovery已有不同原文、读键异常、备份写失败/读回不符，则false且不覆盖原记录；已有相同备份可重试。正常合法旧checkpoint直接保存，不碰既有recovery，单备份槽不做自动淘汰或多版本系统，不打印原文、不加UI通知。

独立执行session-recovery.test.ts与既有session.test.ts，8/8通过；覆盖正常/缺失键、坏JSON/版本/结构/空原文逐字备份、不同recovery拒绝/相同允许、读取/备份写/读回失败保护、主键写失败保留双记录并可重试，及原刷新/重来闭环。限定文件diff --check通过。此修复解决上述P2中无效blob被静默覆盖的路径，并阻止保存阶段读错误；未声称已自动恢复原局或解决所有storage异常。

剩余入口边界已另告根：若启动load读取短暂抛错但save时读取已恢复且原blob合法，单独saveRun仍不能识别错误fresh与显式重来（loadRun的undefined不含原因）。要覆盖该情况，main需保留读取结果/禁止异常fresh自动保存，或引入单独状态读取API；本轮未擅自改main。根已核对新诊断viewport1280×720与用户截图1281×954不同，进一步说明当前ACK不能认定用户原局已丢。角色stats领域尚待battle Sol最终release，未提前批验或全测。

### status API与入口闭环（2026-11-04）

按根再次授权，仅修改session.ts与session-recovery.test.ts：导出RunReadResult/readRun，loaded附checkpoint，null键为empty，存在但不合法（含空字符串）为rejected，storage缺失或getItem异常为unavailable；读取不写任何键。loadRun为兼容wrapper，仍只返回有效checkpoint或undefined。独立session-recovery7+既有session3共10/10通过，新增四状态分类/瞬态读取失败后可读状态保留测试；限定diff-check通过。

根拥有main并已完成消费，现已实际复读：loaded才向runtime传checkpoint；unavailable启动锁persistenceEnabled=false，初始save/后续订阅/pagehide/HMR均走同一gate，不会读恢复后自动覆盖合法旧记录；loaded/empty/rejected可save，rejected由saveRun先保留原文，备份失败不写原键。只有本批game.restarted事件才明确解锁保存；lastSavedAt仅成功save时推进。DEV inspect仅报告原读取status，不写存储。此main差异为静态复核，无真实用户存储或HMR操作；原P2两条已复现路径现有最小保护闭环，不代表已找到/恢复用户原页数据。

## 角色属性根集成最终批审（2026-11-04）

结论：根集成Sol代码审查通过，无新增阻塞。实际阅读contracts属性/装备贡献类型、characters共享视图、constructor/initial/recruit、loadout编译、engine消费调用点、公开projection与root actor测试；未重跑battle负责人已完成的核心21项，未越界改属性/UI文件。

- runtime克隆恢复状态后先normalize个人XP再normalize baseStats；neutral默认attack0/accuracy1/crit0等不替换角色身份、XP、法力或装备，重复恢复不叠加。新初始/招募每次独立创建base与elementBonuses，无共享对象；招募继承run mana增益一次，已有角色存档不重应用。
- getCharacterStats统一汇总base/equipment/run/sequence/final；装备按双向wand/gear归属与去重校验贡献，基础数据不被装备数值回写。compileWand复用final，把flat attack/range、百分比、品级、奥术和元素分别算一次，projectile/beam附独立attackRoll快照；治疗/护盾不误用攻击/暴击加成。impact/beam/attackRoll仍独立复制。engine既有入口消费相同final mana上限/恢复，实际命中/暴击/击杀幸运使用发射时来源信息，其具体规则以battle Sol域验收为准。
- runtime成功构筑事务后按新的有效maxMana夹紧当前mana，卸装备不超上限，重装不补满，不修改base；失败事务不触发该副作用，仍复用统一revision/receipt/通知。角色页与Agent的stats均复用共享helper及传入catalog，projectFrame传递同一catalog，不另写属性计算。
- projection保留个人xp及进度，新增base/equipment/run/sequence/final数值贡献；stats视图仅当前角色有效贡献，不输出整份catalog/随机流。attackMiss/critical等按事件/布尔白名单，未知定义与额外payload继续过滤，普通网络仍不能解锁作弊。

实际独立仅运行runtime/actor-stats.test.ts与agent/projection.test.ts，6/6通过（legacy默认不重置、卸杖容量/不回写base、招募隔离及一次继承、数值贡献/接触事件过滤与原隐私权限）。没有重复loadout/battle全套或运行全仓，没有访问用户浏览器/清存档或视觉验收。session保护代码由本审查按授权实现，main由根实现；其余本批只读审查，其他结论保持。

核心release后的最终静态收敛：根确认battle集中47/47及定向strict TS通过，本审查未重复。实读最终projection：character的baseStats/stats由显式getCharacterStats结果覆盖，wand.statBonuses按九个有限数值字段及九个合法Element白名单重建，额外payload不随新属性透出；attackMiss/critical/beamId仍严格事件字段白名单。只重跑新增恶意属性披露用例（test-name-pattern），1/1通过，包含原state不被投影修改。再次复读main读取状态保存gate保持正确。目标、共享helper分层、角色/装备/符文/序列贡献复用、运行时唯一权威及后续装备扩展接口均通过；UI独立验收、一次完整tests/type/build由根统一安排。本审查无新增阻塞项。

## 下一波预览与授权定向补齐窄审（2026-11-04）

状态：本批Sol复核通过；波次预览通过静态复核，定向补齐的run授权隔离P2已修正关闭。未改核心/UI、未访问用户页面或存储。

- getWaveProgress在ready使用wave+1，同一getWaveSpec生成总数/标记，直接返回progress/defeated=0与cleared=false，忽略上一波存活/剩余计数；battle/reward仍使用当前wave，reward满进度。新增wave/preview显式告知消费者当前语义，无独立UI节点推算。实际阅读新增准备→下一波战斗对应测试，不重复全套。
- updateAuthorizedPreview要求当前cheats.unlocked、三定义全部存在、精确旧unlock回执executed、新请求backpack回执未executed；仅selected三项+missingOnly走既有dispatch，原enabled=false会在赠送后恢复false。同新请求回执防重复，DEV异步import后runtimeActive守卫阻止已销毁实例操作，生产/普通HTTP无新增解锁入口；没拿到用户前台ACK，不能声称用户run已写入。
- **[P2，已关闭] 旧授权回执跨run存活，不能证明当前run被授权。** runtime显式重来保留results，因此旧unlock executed也在新run。原独立内存复现精确旧授权unlock→restart→新局手动unlock→update获赠3项。根已增加实际旧ACK对应runId=demo，与精确旧receipt联合授权，重来生成其他id无法匹配；不是单靠通用demo id授权，也不依赖会裁剪的events。已实读修正及新增restart→unlock checkpoint不变断言，独立只运行chain preview目标用例，1/1通过，保留授权局补3/幂等/原toggle恢复与不赠其他定义检查。未替根改preview/main。

本轮仅必要问题窄复现，无全仓/UI测试、截图或用户存档操作；既有角色核心与其他领域验收保持。

## 清波交接性能只读调查（2026-11-04）

本轮是证据与建议，不是改动后的视觉/性能验收。没有本审查既有独立browser profile，按授权只读调用流并做Node小度量，未新开5173页面/profile、不碰用户IAB、未截图、未写App/RewardChoices。

- engine在同一transition中真实damage→enemyKilled→waveCleared，随即phase=reward、entities=[]；runtime同一个同步tick生成reward.offered后仅通知一次最终快照。React没有获得一个独立的最后敌人HP0中间快照；Battlefield和CombatEffects还会据reward阶段移除普通敌人与在途弹体。用户看到的“未呈现死亡就进奖励”可由这条交接解释，不代表引擎在真正致死命中前清波。现有敌人/弹体50ms位置补间可能尚未视觉追上最终结算。
- 合成fixture（非用户save）：wave11、33items、400历史事件、100命令回执、最后弹体已在真实接触点且敌人1HP。10次预热后100次度量，整个runtime tick含notify、checkpoint克隆、JSON解析/序列化及内存storage save，中位1.520ms、p95 1.821ms、最大2.296ms；其中checkpoint+内存save中位.549ms、p95 .822ms。damage/kill/clear/offer为连续seq401..404，gameTime均50ms。这是整个tick耗时上界，不是单独精确wall-clock kill→offer插桩，且不是浏览器sessionStorage或用户真实大存档；未见此fixture域内1秒等待，不能据此排除具体设备/存档的其他成本。
- 初次读取RewardChoices正反面均无条件挂载。当前样本四卡有34个PencilText+8个PencilSurface，正面只需8文本+4surface；详情为d项时每卡文本数3+2d，不应直接宣称每次固定40+。本地已安装公开PencilText布局effect中，inViewport文字直接同步paintText→measureLocalTextLines/renderPencilText；inViewport只检查几何裁切，不检查backface-visibility/aria-hidden/inert。因此隐藏背面仍可能同步支付测量/手绘成本，开发StrictMode也可能重复setup。该证据支持首挂主线程成本假设，未用浏览器LongTask/PerformanceObserver证实约1秒具体来源。调查过程中根已开始preparedBacks条件挂载修改，以上数量描述的是初读基线，不冒称最终实现性能。

最小建议已通知根：保持engine phase/HTTP立即权威一致，仅在battle→reward当次UI交接保留末场景或按enemyKilled派生装饰死亡收尾；给最终impact至少一次paint机会（双requestAnimationFrame或等效帧屏障，随后约200~300ms短尾），再挂奖励。单setTimeout/在单rAF中立刻挂大树不能可靠保证先paint；仅延迟卡不保留最后敌人也不会自动出现死亡帧。初次恢复已reward直接展示；run/wave改变、外部领取/重来/新波或卸载取消旧回调，不能晚到覆盖新状态。反面整棵子树首次翻面才挂，之后保留，降低首挂成本并保留交互状态；这是挂载策略优化，不改变手绘组件或伤害逻辑。未触实施文件，交由既定App/UI与RewardChoices负责人收敛。

### 死亡收尾与奖励懒挂载落地窄审

结论：本路径权威/正常交接逻辑通过静态审查；下列两处低风险生命周期建议已另告根。未再开profile或用户IAB，正常点击验证由根唯一自有profile负责，不冒称本审查进行了浏览器交互。

- DeathEffects仅消费新enemyKilled并验证有限坐标，不读预测damage来假设死亡；初始游标跳过历史，换run重置，至多24条，各180ms墙钟expiry并清timeout，不显示虚假HP、不写玩法或延迟领域奖励。CSS为pointer-events:none装饰、reduced-motion仅淡出。
- useBattleSettlement仅返回显示ready，不改phase/dispatch。id:wave绑定、phase判定使旧readyKey无法让其他局/波次显示奖励；初始checkpoint已reward同步ready，不重复收尾。battle→reward通过rAF后180ms timer再startTransition挂卡，允许末击/死亡先呈现；key/phase变化和卸载取消rAF/timeout，ready/defeat不出旧奖励，外部claim不被延迟。慢设备确切paint/挂卡长任务效果仍待真实浏览器证据。
- RewardChoices首次flip同时准备back与翻面，未翻过的背面整树不挂，翻回后保留避免重复初始化；事件stopPropagation维持翻面不领取，正常滚动/选文抑制逻辑未变。原双面首挂基线已消除。
- HUD遮挡修正：game-reward-stage全屏区域pointer-events:none，仅reward-choices恢复auto；关闭MotionPresence仍inert且aria-hidden，退出保留期间不会因子树pointer auto恢复交互。真实入口点击是否可达由根profile验证；本次只审规则与叠层关系。
- 非阻塞建议1：DeathEffects换run的清空在passive effect，render当前仍直接visuals.map，若重来恰在180ms尸体存活期，旧corpse可能在新run首paint短暂闪现。建议同BloodDecals按run匹配门控渲染，先隐藏再清状态。
- 非阻塞建议2：MotionPresence保留旧子树280ms，若外部命令极快重来/换波，RewardChoices未显式key且奖励ID可能重用，旧flipped/preparedBacks可能被保留；建议组件key绑定runId:wave，防同奖励ID跨局复用交互状态。正常人类点击间隔不构成领取权威漏洞。

实际仅独立执行death-visuals.test.ts，1/1通过；DeathEffects/RewardChoices CSS经PostCSS解析通过。没有战斗大套或重复此前性能统计，没有修改App/RewardChoices/其他UI；其他验收结论保持。

最终收敛补记：已实际复读DeathEffects新增cursor.run匹配渲染guard，换run的旧corpse闪帧建议关闭；同次最新App读取已确认RewardChoices有key=`state.id:state.wave`，快速换局复用交互状态建议也关闭。根报告唯一自有profile完成正常开始→5倍首波→reward，详情/背包/菜单的elementFromPoint及真实点击均通过；这份交互证据来自根，本审查未重复。只正面首次挂载已代码确认，但优化后具体设备LongTask与“1秒”下降值未测，不作性能幅度承诺。本路径无领域阻塞，视觉确认仍由用户完成。

## Double/Split真实施法与共用布局批审（2026-11-04）

状态：本批根适配通过；两项射线方向问题已修正并经下文窄复核关闭。只读实际compile/castPattern/effects/projectile/beam/contracts与布局适配，不碰正在并行的slot/grantWand、成长或波次模块。

- compile分别保存burstCount与splitCount，double增加时间批次、split增加同批分支，copies总数min64；castPattern集中按120ms生成有界计划，旧仅casts调用保持空间复制兼容。新计划实体立即占projectile512/beam24全局预算和单次64上限，ID包含seq/index并防碰撞，不靠UIsetTimeout造弹。
- 等待实体无spawn事件、不可视、不耗寿命或首pulse倒计时；advance先扣launchDelay，激活时用原来源角色world anchor重新选活目标，只有本slice激活后的余量推进飞行/寿命/pulse。等待期间pause/backpack冻结，checkpoint字段可序列化；清波/失败沿原模拟清场，pending不阻止清波。launch后丢目标保持记忆点消散，不偷换目标。mana/cooldown只在初次castSpell接受后统一支付一次，延迟激活不再扣费。
- projectile初始waypoint是真实模拟短分叉，先走独立支路再homing；独特目标优先，单目标支路也有不同路径。beam每批延迟和首pulse钟独立，单目标角度偏移限制在宽度内保证真实接触；多目标分支重复时见下P2。
- useCombatLayout供两表现层复用，测量真实hero bbox/容器并observe尺寸、角色集合变化时重建、cleanup断开；不写回engine。projectile actual-origin偏移替代固定96px，每个来源使用同一world anchor约定，命中后hitIds避免分支回hero，pending隐藏；CSS仅50ms插值与真实位置读取。

1. **[P2，已关闭] beamVisual逐轴夹端点会扭曲权威射线。** 原表现把targetX/Y各自clamp0..100，不等价于裁剪直线。独立复现50/84→130/4，在1000×800原显示角-52.001°，真实映射角-38.660°。现已去逐轴夹紧，有限端点按真实值映射并交overflow:hidden裁剪；独立角度断言通过。
2. **[P2，已关闭] beam split分支多于活目标时重叠。** 原launchBeam只有targets.length===1才spread，split4遇2目标仅2个distinct segments。现按每target局部分支index/count做宽度内偏移，独立复现4段均不同且100ms脉冲两目标各受2次5点伤害，真实接触保持。

实际独立仅运行cast-pattern目标3项（延迟/冻结/首pulse/单次mana），3/3通过。额外内联验证pending lifetime在等待期不变、跨120ms仅激活余量消耗、beam首pulse倒计时相同规则、backpack冻结、512pending预留预算拒绝新增与清波清空，通过；另两项P2按纯函数/内存状态复现。未重复全部impact/speed或成长波次套件、未开browser/截图，未修改核心/UI；其他验收保持。

### 用户新ballistic规则后的窄复核

根随后按用户新要求将飞弹改为发射heading快照与真实扫掠碰撞；本段覆盖上一轮“失去预选target飞至记忆点消散”的旧验收语义，不应继续拿旧规则判断当前实现。

- 实读collision helper：以本slice线段与radius1活敌圆求最早进入点，排除已hit IDs、死亡/非enemy与非有限目标位置，近似同距用ID稳定排序；从圆内起飞记distance0。advance截到场地边界再sweep，split waypoint前后两段都sweep，非分叉按heading一直飞，不再追随targetId或因原目标死取消。真实接触才resolveImpact；chain命中后换下一leg heading，pierce保持入射heading与8目标预算，仍消耗同一寿命，不造无限后继弹体。
- pause/背包/launchDelay、5秒active life、64/512预算与清波清场边界保持。目标死只改变潜在碰撞物集合，不强制换向找离线路敌人。新outOfBounds原因已加入投影固定枚举，未开放任意字符串。
- 实际独立只运行projectile-collision.test.ts，3/3通过（死目标后继续/离线不追、500速度中途遮挡不穿模、无命中最终出界）；额外内联验证split waypoint途中拦截命中、同距ID tie、两beam修正真实接触与角度，均通过。未重复根39项或成长/波次16项，未改runtime ledger/slot领域或用户页面。
- 非阻塞表现残留已告根：当前CSS仍用target-position计算朝向，新ballistic越过原目标位置后向量会反向，方向性bolt/尾迹可能与实际heading相反；建议优先用有限headingX/Y做显示角，旧存档再fallback目标向量。本项不影响碰撞/伤害，代码审未冒充视觉确认。

## 累计统计、领地升级修复与怪物体型接线批审（2026-11-04）

结论：本批集成代码复核通过，无新增阻塞；累计统计的数值恢复P2已修正关闭。本批只更新审计记录，未修改业务/UI、未访问用户浏览器或真实存储。

- 累计统计由运行时事务维护，不拿当前金币余额或现存背包充当完整累计数。成功赠送/招募与战斗新增事件累加，合成、消费金币和装备变动不倒扣；boss是敌人击杀子集，跨级按level与previousLevel差累计。回执在checkpoint恢复后仍阻止同命令重复累计；复活保留本局累计，显式重来清零。合法完整统计直接恢复，不重放裁剪历史。旧档只以存活物品、领取历史、个人等级和保留事件恢复可证明下界，重叠证据取max，无法证明完整时complete=false。
- **[P2，已关闭] 有限小数或不安全整数可带complete=true恢复，公开投影却归零。** 原内存复现1.5在恢复后仍完整、投影为0，导致权威与公开统计不一致。现八字段统一要求非负安全整数，非法旧数据回退不完整下界；所有实时增量复用安全累加helper，溢出饱和并标记不完整。最新补充也将非法characterLevelUp等级事件标记不完整，不再静默跳过而保留complete=true。独立边界两测试2/2通过；另内联覆盖八字段×小数/超安全整数/NaN/Infinity/负数、恢复与投影一致、恰达MAX_SAFE仍完整而再加1转不完整，以及非法升级事件，均通过。负责人报告统计7项及定向strict通过，本审查未重复全套。
- 领地升级不再受旧玩法等级上限限制，价格与容量继续按共享helper计算，保留安全数值边界。付费修复只补选定wall/shield缺口，不升级或增加上限；满值、余额不足、失败阶段或非法/溢出数值均在提交前拒绝。事务新建状态并统一推进revision/seq、缓存回执；UI报价、Agent能力和实际命令共用同一预览计算。金币消费不会减少coinsEarned。独立内联验证旧level6可升7、wall35缺口报价18与shield26缺口报价8、扣款与输入状态不变、满值/贫穷/defeat/数值越界原子拒绝，均通过。
- 已阅读根新增repair远程集成用例：真实dispatch、公开报价、重复命令与checkpoint后重试、满值拒绝、事件增量和非法track解析均覆盖。根随后报告repair真实remote integration连同preview/beam/collision定向17/17通过；此为根的执行证据，本审查未重复运行。根全仓277项曾发现的旧追踪断言与growthProfileId恢复差异由根收敛，不能把本批窄审表述为全仓已绿；最新fresh/recruit显式profile已静态核对，最终全仓状态以根报告为准。
- 怪物定义与合法size覆盖共用尺寸helper，显示像素、血条宽度和真实扫掠半径均从同一预设读取；未知定义/非法覆盖回退normal，资源查询使用own-key，不开放私有catalog。独立只运行新增large monsters collide用例，1/1通过，证明大体型真实接触、普通及显式小体型不误命中。

本批没有重复领域大套、截图或视觉验收；领地、统计与体型规则的其他领域测试以各负责人及根的已报告结果为准。

## 领地被动恢复与时钟接线窄审（2026-11-04）

上一轮最终全量278/278、build与registry TS通过，来自根报告。本轮是其后新增能力的独立窄审，不继承该结果作为新增代码的全仓验收。

业务代码审查通过，未发现新增P1/P2；领域测试夹具仍有一处待负责人收敛，已通知根。仅修改本记录，没有修改恢复模块或UI。

- 壁/盾分别300解锁至level1，后续按当前level×150扣款；共享冻结规则分别给每级1/s与2/s，不共用等级。购买事务仅升级选中轨，不立即补HP/shield，不增加容量；ready/reward及暂停battle可买，活动battle/defeat拒绝。安全整数等级、有限安全价格/资源与revision/seq提交边界均在提交前检查，金币消费不减少累计收入。runtime统一缓存回执，checkpoint恢复后同ID不再扣费或升级，显式restart回两轨0。原即时付费repair独立路由保留。
- runtime先将输入dt夹至250ms，再乘speed；engine按最多50ms模拟片推进，恢复helper只消费已缩放的step，不再乘speed、不运行独立计时器。phase非battle、paused或backpackOpen均不回。每片先敌攻、再败北检查、再恢复；敌攻归零会立即defeat并break，不会由同片高恢复率救活。hp本来为0时helper也拒绝壁/盾两轨恢复。
- helper校验资源与恢复等级，缺失旧等级视0；恢复不花金币、不单独发事件，随同engine统一revision/通知。先比较gap/rate再计算乘积，巨大有限dt可安全夹至真实容量；不把Infinity或非法dt当恢复时间。两个轨道独立读取各自rate与capacity，满值不再增长。
- Agent parser只收合法wall/shield且移除外来rate等字段；command schema、capabilities与实际事务复用同一预览，升级事件仅显式track/level/cost/rate等白名单字段公开，恢复等级跟随territory状态与checkpoint持久化。

实际独立运行territory-recovery-integration.test.ts，1/1通过（解锁、独立升级、2倍恢复、ready/暂停冻结、同ID及恢复后幂等、重来清零）。额外内联通过0.25/1/5倍runtime接线的实际恢复量与gameTime、敌攻致死优先于两轨level1000恢复且50ms即败北、纯step输入隔离、ready/reward/defeat不回、MAX_VALUE有限dt夹容量、远程非法track拒绝与额外rate剔除。内联初次因审查脚本误导入不存在且未使用的projectCapabilities而未执行断言，去掉该导入后全部通过，未修改实现。

待负责人收敛的测试夹具：content/territory-recovery.test.ts中legacy levels用例直接createInitialState后断言wallRepairLevel为undefined，而根已给新初始状态显式0；应先删除两轨字段模拟旧档，再检验默认0。此为实际读取发现的测试与fixture不一致，未重跑领域大套冒充通过；修正及最终全量结果由负责人/根报告后补记。UI图标、价格间距与恢复行由UI负责人及用户视觉验收，本审查不作视觉结论。

## 血迹与缩略图PencilShape接线轻审（2026-11-04）

已实读根的BloodDecals.tsx/.css、floorBlood.ts，以及UI负责人release后的GamePencilShape与WandMiniatures及库实际绘制依赖。本轮未发现新增玩法P1/P2；未改UI或库文件，未重复库负责人Chromium像素验证。根报告血迹规则4/4及两套TS通过，库负责人像素覆盖由根转述，本审查不冒充独立执行。

- 血迹每mark一个公共形状组件，最多96，复用稳定滴落数据生成同向闭合二次曲线compound path，viewBox为0/0/120/120，非零填充。强度、元素颜色、范围、寿命与水洗仍来自呈现规则；水元素以catalog元素识别。形状只负责描绘，不消费game RNG或修改战斗。外span保留位置、宽高、中心定位和opacity，run匹配门控与可选艺术缓存保持。
- geometry memo依赖id/maxHp/level/grade/effect，不含washed或clock。时间衰减与水洗不重建geometry；库的祖先style观察可能安排paint检查，但内部稳定key会跳过相同绘制。mini实际placement经共享rotateInventoryCells生成cells，宽高随法杖尺寸与36/44px入口缩放，填充/轮廓复用装备视觉字段，flash仅外层CSS，不改施法权威。
- release适配器具备此前两项修正：legacy cells先减source原点，再按mask剩余空间计算位置；legacy path在源坐标平面clip后按显式目标尺寸scale，当前血迹零原点viewBox适用。候选PencilShape存在时透传公共props，否则用registry PencilSurface兼容，不引入私有Host入口。本轮仅代码审，不替代负责人实际fallback与像素验收。
- 一项非阻塞且限定范围的体积建议已发根：当前`const inkra = Inkra as ...`传递整体namespace，根构建报告主bundle从764KB增至2480KB、gzip777KB。建议改成直接静态读取`(Inkra as ...).PencilShape`的候选常量，PencilSurface用静态named import或单独静态属性读取，避免整体namespace逃逸。类型cast擦除后留下可静态解析的导出访问，保留旧registry无Shape时的fallback；包sideEffects仅CSS，支持此tree-shaking假设。是否确为体积原因、改后是否下降仍需作者构建验证，本审查未把建议称为已修复或扩大至一般性能优化。
- 审查中曾向根提出mini新geometry对象可能每tick重绘；继续读完库发现layout effect依赖是shape.key等稳定值，而非shape对象，已立即明确撤回该判断。新geometry只可能触发resolve计算，不能据此断言每tickcanvas重绘，不列问题或要求修改。

本轮只更新审计并给局部源码建议，没有新开浏览器、重跑血迹/库套件、量测真实首屏或作视觉接受结论；最终体积、UI review与用户视觉由对应负责人收敛。

## 装备、药水与击杀掉落核心接线定向审（2026-11-04）

结论：已release核心的源码与根接线定向复核通过，未发现新增P1/P2；UI库存类型/真实DropTarget与外部库指针取消验证仍由对应负责人收敛，不包含在本结论。未修改业务/UI，仅更新审计。

- 内容新增可选gear/items定义与实例registry，8件装备覆盖四部位、3种药水覆盖领地HP/盾及全队法力；旧档缺失字段兼容。工厂生成脱离定义引用的实例，装备只取有限合法属性/元素，药水实例不拷贝可篡改效果；使用时从传入catalog取定义与品级倍率。新知识gearIds/itemIds独立于spell/arcana，不把装备或药水混进法杖物品registry/backpack。
- 穿戴要求四slot合法、registry键与实例ID一致、装备与角色声明双向唯一。跨角色移动清源声明，目标同slot旧装回到未装备registry，再把新装与目标双向绑定，原子提交；失败不改输入。卸下/丢弃允许清理已移除定义的旧装，但穿戴中不准丢弃。属性计算仅累加有效双向所属装备；runtime成功事务后按最终maxMana夹当前值，装备增加上限不自动补满，不回写baseStats。
- 药水在ready/reward或暂停battle使用/丢弃，活动battle和defeat拒绝；0HP即使阶段不一致也不能用药复活。HP/盾只补真实缺口，partyMana逐人取共享final.maxMana并计算实际增量，任何非法资源使整笔拒绝，全满不消费。有效使用只删除指定实例，和资源修改在同一commit，不发第二个独立消费事务。
- loot只处理真实dead enemy，内容pool做own-key与定义结构检查，首次装备发现/合法boss有有界保底与品级下限，普通装备率按幸运有上界，药水率单独判定；抽取沿保存的combat随机流。ID检查所有实例registry、角色/敌人/法杖及背包避免覆盖。成功入库同时发现定义并发lootGranted；调用点在settleDeaths，随即移除死敌，恢复存档不会重放已结算敌人或历史事件。loot validAsset当时仍由owner做最终TS收口，本审查未把中间类型问题扩大为运行时失败，也未冒称替owner跑过TS。
- 普通projectContent只按gearIds/itemIds导出已发现定义，state.gear/supplies显式重建公开字段；属性贡献仍经数值白名单。事件仅增加合法slot/effectType/kind/grade与已发现definitionId。远程命令对仍存在但未发现的装备/药水拒绝，已被消费或丢弃而缺失的实例交runtime，从而先命中原回执；parse不透传任意效果字段，cheat仍受本地解锁/toggle控制。grantGear/grantSupply与实际装备/药水路由均由根接入，不开放普通网络解锁。

实际独立只做新增内联边界验证：真实remote穿hat(+15)→喝药115→同slot换hood(+10)后110→卸下100，旧hat回未装备registry且只有一个maxMana贡献；discardGear/discardSupply与用完的useItem经checkpoint恢复后重放原executed receipt，state逐字保持；隐藏gear/supply定义与实例secret额外字段均不进入frame，hidden穿戴/使用命令拒绝且状态不变，全部通过。未重复根已报告的真实route2与公开projection等6/6、未重复领域大套。根报告授权用户run demo/wave22获8gear/3supplies且金币/布局保留，本审查未访问该页面或存储，不把根ACK作为本审查操作结果。

此前被动恢复legacy测试夹具已再次实读确认先delete两轨等级再断言undefined，源码层面的夹具修正关闭；未重跑旧套件。最终全量测试、build/TS与UI视觉仍以根/各负责人最终结果为准。

### 根后续收敛状态补记

根报告新全量346项中344通过、2失败，定位为旧金币/死亡元数据用例假定死亡只消费一次随机数，与新增loot真实消费冲突。已实际读取actor-combat与death-metadata对应两用例：新增局部coinOnlyContent清空gear/items目录，并把该用例全部step调用传入同一目录；原金币结果、捕获的sourceLuck、固定seed与死亡元数据断言均保留，没有更改玩法随机算法或放宽expected seed。该测试隔离符合各自验证金币/元数据路径的范围，完整loot路径仍由其专属域用例及根真实死亡接线覆盖。根此时正执行定向复验，本审查未重复运行或声称全346已绿。

同时已静态核对八件装备shape均改为单格；适配器已按建议分别静态读取PencilShape候选和PencilSurface，不再给整个namespace建别名。根改后build报告814.98KB、gzip261.26KB通过，相对前次2480KB/gzip777KB体积确实回落；此构建证据来自根，本审查未另测首屏性能。最终TS、旧registry兼容和UI仍由负责人收口，不据本次build推断全部验证完成。

根随后完成最新一次全量npm test，351/351通过，覆盖此前金币RNG夹具隔离；根另报告新增clearWand真实remote事务及receipt重放5/5通过。本审查只读核对`../../work/wand-defense-final-tests.log`尾部，确认tests351/pass351/fail0、无取消/跳过，不重复执行测试，也不把本记录更新算作clearWand源码复核。此结果替代上段344/346的旧测试状态；UI/库bounds/actions接线仍进行中，最终build及两种TS待稳定后由根统一验证，本次不宣称已完成。

## 开战起点持久化与战中刷新重试窄审（2026-11-04）

本段按用户最新要求替换此前500ms合并保存审计；旧结论中“战中暂停编辑/控制立即保存、pagehide保存精确中途状态”已不适用于普通浏览器自动存档。最新实现源码复核通过，未发现新增P1/P2。仅阅读main/session、现有3项autosave测试与必要调用路径，未运行测试或UI性能检查，不沿用先前351项结果宣称新策略已经过全量验证。

- shouldPersistRunChange只在非battle或本次新事件含waveStarted时允许保存。普通战斗效果、暂停构筑、药水/领地/装备操作、速度和作弊控制即使成功，也不替换已保存起点；这是用户明确选择的战中整体回滚语义，不再以旧“事务即时持久化”标准当作退化。运行时事务、receipt与HTTP即时权威不受影响，非battle的准备/奖励领取/败北/显式重来继续同步保存。
- beginWave同步将wave加1、phase置battle、entities清空、waveSpawnRemaining设完整getWaveSpec.count、spawnRemainingMs设0，然后发waveStarted；没有首tick推进或先生成敌人。dispatch先把startWave结果写入results再notify，main保存的完整checkpoint含开战receipt与此前波次全部进度。刷新直接恢复battle起点，不再dispatch startWave，不把当前22波变23波，也不重置整局或前21波金币。
- checkpoint包含整个state、pausedBeforeBackpack及results。恢复使用该快照并恢复随机流，不合并后来的内存数据；因此中途金币/XP、升级赠品、loot与其发现、累计统计、药水消费/装备变动及中途命令receipt随同回滚，不会仅重刷敌人而保留已拿收益。恢复后的同start命令由已保存receipt挡住重复开波；已结算reward/defeat会保存结算状态，随后刷新不把已保存收益再按起点发一次。
- 初始save、pagehide与HMR close统一改走saveOutsideBattle，在battle（含paused/backpack）都不写，不因刷新/热更新覆写波起点；普通订阅只使用本次seq增量事件，历史waveStarted不会被后续tick误当新开波。没有新增timer或捕获旧快照。原unavailable保护与拒读原文备份仍保留，显式restart先解锁保护再保存ready。存储失败/受限时仍以原保护逻辑为准，本轮不作存储必定成功的承诺。
- 通用runtime.checkpoint/saveRun并未改成起点快照，旧或手工保存的精确战中checkpoint仍可按原样恢复；本次改变限定在浏览器main自动保存策略，未擅自迁移或清除旧记录。
- autosave测试覆盖battle事件与空事件（pagehide/HMR gate）拒绝、waveStarted允许、ready/reward/defeat允许，以及真实runtime+内存storage的wave21→22与restart保存。根已按审查建议补真实战斗收益：tick至enemiesDefeated>0且XP增长、仍处battle，写入数仍仅ready与开战两次；恢复state与entry深相等、保留原coins152，并重放start-22得到原receipt且state不变。本审查已实读这些最终断言，先前真实收益/开战回执覆盖提示关闭；不冒称做过真实浏览器刷新。

根报告autosave+session+recovery定向13/13通过，本审查只读核对`../../work/wand-defense-autosave-tests.log`尾部tests13/pass13/fail0、无取消/跳过，没有重复执行。此为根执行证据，不是新增全量或最终build/TS结论。本轮只有审计文档变更，无实现修改、无重复全量/大矩阵、无用户页面或存档访问；UI独立性能检查仍由原负责人完成。

## 神话法杖授权赠送与场外入场窄审（2026-11-04）

状态：正常授权/重入/战斗起点门控源码通过；本轮发现的部分赠送checkpoint恢复P2经根修复，已按下文源码与新增用例复核关闭。仅审查及此前内存复现，未改业务/UI、未触用户页面或存储。根随后取得实际用户赠送ACK，本审查只读核对`.local/targeted-preview-result.json`：executed、run demo、wave25、3根mythic/Lv50/5×5，preservedCoins/Layouts均true；此为根实际赠送的回传证据，不是本审查执行结果，恢复修复另有下文依据。

- grantWand可选grade经remote枚举与runtime再校验，可选level须正安全整数；仍要求原cheats解锁与enabled，未知模板拒绝。工厂创建空且未装备的新法杖，不迁移原法术或改金币。授权helper要求既定demo run、cheats.unlocked及精确旧人类unlock成功receipt，重来换run无法沿用；本请求固定3根5×5神话Lv50，不开放普通网络解锁。
- battle包括暂停时均延后赠送，不覆盖已保存波起点；main复用现有save订阅，仅非battle通知触发onDurablePhase，没有新增每tick完整snapshot listener。grantingWands防helper内dispatch触发通知重入；后续接入newMagic后不再单凭wands完成清回调，而由两helper各自complete guard防重复，以免遗漏新增魔法。HMR close仍清onDurablePhase，异步import也检查runtimeActive。正常路径在非battle每次dispatch后保存，全部完成receipt仍防重复赠送。
- **[P2，已修复关闭] 部分赠送存档恢复后不能完成请求且遗留临时作弊开关。** 原因是每次子dispatch均会保存，合法中断checkpoint可含prefix:enable及wand:0/1成功回执；恢复补第三根后，本次added仅1，不满足严格等3，后续永远partial。临时enabled=true也会误作原开关。修复前已独立纯内存复现3根齐而partial、无complete且enabled=true。根现用enable-from-disabled/enabled成功回执持久标记首次开关，恢复时优先读marker；完成度改查prefix:wand:0..2三条executed回执，单次added只作为报告增量。已实读新增marker+2根checkpoint恢复用例：只新增1、总3、executed、toggle恢复false，后续helper不再变化；源码complete guard仍让此前已经完成的generic-enable旧赠品不重发。本审查未改owned实现，也未声称能从没有原开关marker的任意历史半途档推断原值。
- 已读mythic-preview与原wand-grant测试及根日志：根mythic/preview/wandgrant定向10/10通过，日志尾部pass10/fail0、无跳过/取消已核对；现有用例覆盖正常赠送/重复、战中不动、重来授权隔离、公开gate及非法品级/等级，尚未覆盖上述部分恢复。未重复运行目标套或全仓。
- 场外入场改动只让spawn y按共享体型像素取负，advance的y下界为min(0,原y)，保持真实负坐标逐片向场内走，不在首片夹回0；x与场内上界仍受限，目标路线不新增随机抽取。五档碰撞半径均为旧值×1.8（1.35/1.8/2.7/3.6/4.5），仍由getMonsterSize共享返回，未各处叠乘。现有large graze用例偏移2.8与新半径区分相符。已读offscreen测试覆盖普通/三档boss场外连续移动及后续无额外RNG；根报告该批目标20/20通过，本审查未重复执行或做视觉验收。

同轮根继续新增grantAuthorizedNewMagic，本审查已实际读取：仍要求同一demo+精确旧人类receipt授权、非battle与自己的complete guard；先确认8定义全部存在，只补3种area法术与5种modifier（thunder-strike/frost-ring/earth-spikes/haste/efficiency/reach/velocity/area），完成按当前拥有定义判断，不按单次新增数，正常结束恢复原enabled且不改旧布局/金币。main同一granting guard顺序调用两helper，无新增battle监听；配方DAG与自动发现尚不在本轮release审查内。新增magic已同步采用enable-from-disabled/enabled持久marker，位于grantPreviewMagic临时enable之前，恢复原toggle不再只猜半途state。未额外重复全量或认定其实际赠送ACK已到。

根修复后mythic/preview/wandgrant目标日志已更新为11/11，本审查只读核对尾部tests11/pass11/fail0、无取消/跳过，未重新执行；新增恢复用例及源码足以关闭本次已报P2，不扩大为全量/真实中断浏览器验收。

## 配方发现接线最终窄审（2026-11-04）

结论：本轮recipeKnowledge与runtime接线源码复核通过，无新增P1/P2。只读实现、相关测试及根状态证据，不执行测试、不修改业务/UI、不作视觉验收。

- discoverAvailableRecipes以已有recipeIds为起点做有序去重，保留旧已发现配方；新增配方要求inputs非空、全部输入已在spell/arcana知识中且是传入catalog own-key，产物也必须实际存在。只返回新recipeIds，不改spellIds/arcanaIds、不取随机数，不把产物知识递归加入下一层，故不会凭输入自动揭开整个DAG。保留既有配方和新发现的判定区分明确。
- constructor在恢复克隆/规范化后补recipeIds，discover()在真实赠送、招募赠品、升级赠品及可见奖励定义发现后复算；成功loadout事务也复算，使成功合成发现产物后能解锁下一层配方，失败事务不新增发现。已知定义集合不会因合成消耗或丢弃而减少，重复调用/恢复结果稳定，不重复抽奖励或回放赠送。
- Agent projectContent仍仅导出已知recipeIds，并按已知spell/arcana过滤inputs、保留unknownInputCount，只有产物定义已知才公开output；配方变已知不等于产物变已知。已读真实recipe-discovery用例：先给lightning-bolt不足以发现thunder-strike路线，再给focus才发现，产物spellIds与公开spells/output仍不出现，checkpoint恢复知识相同。根报告配方/赠品恢复相关7项通过，本审查未重复执行。
- 已读20配方/29spells内容测试，断言唯一ID与唯一output、保留原fireball路线、所有材料存在、9基础法术加20产物覆盖完整法术目录及DFS无环；本段只是读取已有验证，并非本审查完整重验内容域。
- 最新`.local/targeted-preview-result.json`已只读核对为user-area-arcana-20261104-01、executed、demo/wave25、granted8/definitions8，preservedCoins/Layouts与unchangedRun均true。由根实际赠送回传，替代此前新魔法ACK待到状态，不代表界面视觉已接受。
- 根全量日志当时388项中387通过、1失败，本审查核对日志状态并阅读修正后的projectile-speed断言：固定20单位路程、normal敌半径1.8加bolt半径0.4，接触行程17.8；速度72需约247.2ms，50ms片落250，速度144需约123.6ms落150。因此normal期望300→250符合已接受的新接触语义，fast150、speed72/144、CD700、mana96等断言保留，不是放宽速度/频率规则。根正在执行speed/autosave/discovery目标7项；截至本段未收到其最终结果，不把旧全量1失败写成已全绿。

本轮仅更新审计记录，最终全量、build/两种TS与UI/库收口仍以根及对应负责人结果为准。

### 本批最终验证状态补记

根已完成旧批最新整批npm test 390/390，本审查只读核对`../../work/wand-defense-final-tests.log`尾部tests390/pass390/fail0、无取消/跳过，替代此前388中387通过1失败状态。根报告recipegift7/7、mythic11/11及speed/autosave/discovery7/7目标均已通过；本审查不重复执行。另只读核对`../../work/wand-defense-final-build.log`，local build成功，JS860.30KB/gzip275.99KB。根同时明确旧registry TS仍有WandBoard:117的getItemContentPlacement旧类型bridge问题，已交UI修，不宣称两种TS均通过。

用户随后提出碰怪/到射程后持续领域damage，根已另开有界机制实施批；该新增field能力尚不属于上述390测试及本批源码验收范围。本次仅同步旧批验证记录，没有审查新源码或运行任何测试/构建。

## 完整魔法图稿数据与公共工厂分层源审（2026-11-04）

结论：本轮限定的magic-artwork/types.ts、fire-earth.ts、water-wood.ts、other-arcana.ts纯数据源审通过，无新增P1/P2。公共generic factory由UI负责人后续接入，本段对其接入约定给出审查意见，不把计划视为已经完成的实现验收。只更新本记录，未改UI源、未重复执行者已报告的三套typecheck/diff，也不看截图评价审美。

- 每definition暴露完整paths与filledPaths，内容为PencilIconPath标量路径数据；stroke/wash仅在模块初始化创建普通对象，不实现笔刷。三份稿件只有type import，没有catalog/runtime实例引用、Math.random/时钟/DOM/动画循环或自写renderer。模块级数组与对象引用稳定，readonly数组/readonly catalog约束只读消费；没有声称这些数据已做运行时deep-freeze。
- 24源单位对应一格，但绘图在整件source box中完成：长条可跨至72单位，2×2为48、3×3为72，多格/T/L稿件有跨格曲线和整体轮廓，不是将单个小图逐格复制。已实读根修后的regrowth/renewal：右臂叶片/洗色位于上部y≤24，下方主茎位于左臂x≤24，避免L形右下缺格。根先前已做明显bbox修正，本审查不重复几何大矩阵，也不以纯坐标阅读承诺最终像素裁切或审美效果。
- 尚未进入当前catalog的field/quadruple/sextuple等future ID只是数据对象字符串key，没有提前执行catalog[id].shape等读取，因此导入数据本身不依赖不存在定义。不得在通用注册时把这些预备稿无条件解引用成缺失定义；实际factory需先按传入catalog own-key找到spell/arcana定义，缺失时安全跳过。
- 公共API计划分层合理：单一factory统一由定义派生shape、24单位viewBox、cellSize24的clipGeometry及colour，保留稿件path数组原引用，定义对象在模块初始化或稳定缓存创建；页面只传definitionId、尺寸/variant与实例rotation。整件路径一次交公共PencilIcon，以同一原坐标裁切和整体旋转表现，不能按每cell各放一图，也不应因普通battle state/clock通知重建paths/clip来触发无意义重画。
- 当前magicPresentationIcons仍有旧六种presentation与公共viewport/clip入口，本审查按根说明视作正在被generic factory替换的中间接线，不以未覆盖新稿提前报失败。完整目录覆盖、未知ID fallback、实例旋转后的bbox/裁切、性能依赖与UI最终视觉仍需UI负责人release后核对；本轮只确认新增数据边界及接入方案，不宣称全部页面已使用或已视觉验收。

本轮未开启任何子agent或新聊天；后续协作按用户最新偏好执行。本审查只给根源码结论与约定，不替其后续安排独立聊天或修改UI实现。

## 共享魔法特效纹理与调用接线源审（2026-11-04）

结论：已实读MagicEffectArt.tsx/.css及当前CombatEffects、BeamEffects、ChainEffects、AreaEffects接入，源码窄审通过，无新增P1/P2。仅更新审计，未改UI/库，不重复全矩阵或视觉验收；调用方若随后继续变更，最终release仍由对应负责人确认。

- 缓存key只由规范化素材种类及seed哈希四槽组成，别名flame/ring/impact等先折叠、未知kind回退impact；实际最多15种规范资源×4=60 entries。颜色、显示尺寸、实体ID不进入key，seed最多读128字符后折槽，没有无限实体/尺寸缓存。fallbackMask同样按有限kind缓存。PNG保留为data URL，不创建需revoke的Object URL；固定96源图与库有界DPR，不随领域半径创建巨型canvas。
- 同key通过成员集合选一个owner，临时挂载公共PencilIcon或PencilLine生成黑色alpha；TextureSource memo与稳定kind/slot/onReady避免位置/时间更新反复挂绘制器。capture先检查真实非空alpha再toDataURL，成功后断开observer、发布PNG并卸载源渲染；无自写笔刷或rAF绘画循环。多个实例直接共享URL，颜色由外层mask背景色给出。缓存保留有限可复用资源，不要求每个弹体卸载时丢纹理。
- 未完成owner卸载时从其余members选接任者，无成员则清owner以待下次；effect清理删除member，useSyncExternalStore取消订阅，TextureSource卸载断开MutationObserver且finished阻止迟到回调。ready只允许当前owner发布。无context/透明未就绪/读像素或序列化异常时保留静态SVG几何alpha fallback，不阻断游戏；没有无限轮询重试。尺寸非有限/非正不呈现素材，也不加入生产成员。
- public API边界已核对：组件只用PencilIcon的paths/variant/size/sourceSize/seed/decorative及canvas ref，或PencilLine的orientation/weight/seed与普通style；读取本地旧registry备份d.ts确认这些字段及PencilIconPath.fillRule实际存在，未依赖新PencilShape/viewport能力。旧canvas不可用回退是同一作者路径的普通SVG mask，不是另一套手绘算法。本次是源码/类型声明阅读，不声称实际旧registry像素或浏览器上下文丢失测试通过。
- Chain当前使用lightning+variant impact，因此选横向0→64路径，再按真实屏幕dx/dy长度及角度变换，不误用竖直lightning-up投射图；其最多64条短弧取真实chainArc事件，按gameTimeMs衰减，暂停不前进，非battle清除。Beam固定源纹理由外层权威segment长度/厚度拉伸和旋转，不改变射线或命中。Area最多32实体，半径按真实场地两轴映射，windup/active、持续进度/环/旋涡角度来自launchDelay/remainingMs及模拟gameTime，装饰motes/spikes数量固定，不新增目标选择或伤害。
- Combat真实弹体仍读取engine实体位置/heading及同一布局源偏移；素材不做追踪、碰撞或消耗。短impact保留既有performance.now/timeout呈现寿命并按speed缩短、暂停清除，仅是有限32条外观收尾，不作为领域时钟或伤害依据。MagicEffectArt自身无game clock、随机流、runtime dispatch或命中逻辑，所有层aria-hidden/pointer-events none，CSS仅呈现和无障碍降级。

根报告新机制整套416/416及Battle Sol真实集成4/4+TS冻结，本审查未重复执行，也不把该领域结果当成新纹理视觉验收。根合成混合fixture（60敌/300弹/32area/32chain/512history、5倍、120样本）p50 6.47ms/p95 7.96ms是其已报告域内度量，不能称为真实浏览器FPS或证明canvas首挂成本。本轮无新增量测、浏览器/截图或用户存储操作。

## 血迹游标ref与装饰缓存节写窄审（2026-11-04）

结论：只读BloodDecals.tsx本次改动及必要的advanceBloodMemory返回语义，源码复核通过，无新增P1/P2。未修改或重验floorBlood纯规则，也未重复广测、浏览器profile或性能fixture；只更新审计。

- latest ref始终接收advanceBloodMemory最新结果；effect仍在run、nextEventSeq、500ms模拟clock或wave变化时处理，因此仅游标变化虽不再setMemory，下一次事件仍从最新cursor消费，不会用落后的显示state重放击杀/水洗。新增死敌血迹、有效水洗、过期淘汰/预算替换均产生不同marks引用，仍触发React可见更新；纯cursor对象变化不再触发第二次render。
- 可见血迹列表仍来自memory.marks，但opacity每次父state render直接用当前clock与wave计算；500ms衰退不依赖cursor写Reactstate，纯时间未淘汰血迹时仍能更新透明度。gameTime暂停则clock不动，未引入墙钟衰退。水洗只更新washed相关mark，BloodMark原稳定geometry memo保持，不因washed或时间重建形状。
- memory.runId===state.id渲染门控保持，换run首render即隐藏旧血迹；advance检测run变化重置latest并提交新列表。effect顺序先推进latest再保存，保存effect还依赖state.phase，转ready/reward/defeat时读取最新cursor/marks，而非旧显示快照；只非battle写可选艺术cache，不在活动/暂停战斗频繁同步写，不增加pagehide战中保存，与当前波起点重试语义一致。缓存错误仍被捕获，不影响玩法或游戏checkpoint。
- 根同一开发profile fixture（128敌/512弹/32area/24beam/64chain/32hit）报告60次更新由5.909s降至4.861s，React p95由33.2ms降至26.6ms，longtask由18条/968ms降至2条/114ms，Maximum update depth警告1→0；这些是根执行证据，本审查未测量。旧effect依赖不含memory，不能仅由本处源码证明其自身存在无限自激循环；本次可确认去除了纯cursor的每tick状态更新，同fixture警告消失不等于穷尽所有场景成因。rAF数据不支持直接宣称FPS提升，本段不作该结论。

## 怪物有限seed与血迹分帧挂载窄审（2026-11-04）

结论：已读取monsterPresentationIcons有限seed改动；开始本轮时原计划等待的血迹patch也已出现在当前BloodDecals文件，故对该具体源码版本一并窄审，未发现新增P1/P2。最终release与预热测量仍由作者/根报告；本轮只更新审计，不改源、不广测或截图。此前Combat坐标/transform优化仍待最终release单独审，不混入本结论。

- 怪物稳定hash(entityId)%4仅决定四个材质槽，seed为icon.definitionId+槽，不再含每只怪完整唯一ID；不同种类仍有不同paths/filledPaths/颜色与种类seed，size仍从原调用参数传递，未改monsterDefinitions或游戏碰撞。Battlefield活体与DeathEffects都传原definitionId和entityId，同一怪死亡沿用同种同槽，不随机换图。这里只保证seed维度有限，库cache另有图形/尺寸/主题维度与容量淘汰，不声称暖槽后任何场景均零绘制。
- 血迹新增visible ID列表与revealed ref仅控制挂载，latest/memory仍由原advanceBloodMemory完整维护；保存继续读完整latest，绝不保存visible子集。rAF callback只取尚未显示的最多4个mark ID，保持原队列次序，仍有待显ID时才排下一帧。已有ID不重挂，同ID水洗/衰退读取当前memory里的mark与原clock，不按显示时刻重置出生时间/寿命/几何随机数/颜色。
- marks变化先过滤不再有效的visible ID，过期/预算淘汰会从显示与待显集合排除；effect依赖run/marks/paused，清理cancel待执行frame，暂停不排新帧、解除后继续补未显示项，卸载取消。换run重置revealed、清旧visible，原memory.runId门控继续立即隐藏旧局血迹。恢复缓存的未显示marks也走相同分批队列，不假称已有缓存会在首帧全部显示。
- 全部rAF仅装饰挂载，不dispatch、不删权威memory、不改变击杀、水洗、衰退或游戏checkpoint。根报告60新怪ID出生约2.2s与6,218,567 strokes、同ID重挂14ms；60真实击杀血迹约111ms与286k strokes，是其定位首绘成本的执行证据。本审查没有运行这些profile，也未把四槽/分帧源码推断成已验证的性能下降幅度；待作者预热全槽及新ID复验后再记录结果。

### 非战斗暂停存档的血迹恢复展示补查

根随后明确要求区分历史血迹hydrate与战斗暂停冻结。本审查实际复读确认当前展示恢复缺口：visible初始为空，队列仅!state.paused时运行；runtime在ready/reward打开背包也会设paused=true并保存，因此恢复这些非battle存档时，完整memory已存在但血迹整片不可见，直到关闭背包或解除暂停。此前已注明缓存marks仍分批显示，本段进一步指出非battle不应被暂停标志无限阻挡；问题限装饰展示，非memory或玩法数据丢失。

已通知根交UI负责人最小修正：队列门控改为`state.phase !== "battle" || !state.paused`，同时effect依赖增加state.phase，保留每帧4、取消回调与权威memory/保存逻辑。这样准备/奖励/败北可在不推进模拟时钟的情况下渐进恢复历史图，活动battle paused仍停止新挂载。手工精确paused-battle checkpoint的首帧hydrate若要另作例外，需独立定义初始化策略，不擅自扩张本次非battle方案。截止本段源码尚未修正，待作者落地复读后关闭；本审查未改源或广测，其他water/eviction/run取消结论保持。

## 同轮奖励重复恢复的根接线窄审（2026-11-04）

结论：本轮仅根runtime/index constructor与统一随机流/知识发现/领取调用路径复核通过，无新增P1/P2。内容域有限不放回规则由Battle Sol独立审，本审查只读取helper输入输出及ID契约以核对根接线，不重复其域验收。只更新审计，未改源或跑全矩阵。

- constructor先structuredClone输入checkpoint，沿用原恢复与卡片文案规范化；仅phase=reward且语义key集合小于卡数时修复。独特或空奖励不进helper、不消耗随机流，ready/battle/defeat也不凭历史offers重抽。修复保留每种首张已有选项与原ID，重复槽的新卡采用不同ID，不把旧pending claim自动解释成另一奖励。
- nextRewardDraw从现有state.rngState推进原LCG并写回，修复与正常prepareRewards共用同一入口，没有Math.random或第二个未保存流。修复checkpoint已去重，后续恢复不再抽取。main既有初始saveOutsideBattle在reward同步保存修复后完整checkpoint，订阅保存策略不把战斗起点变成中途帧。
- 根只替换state.rewards、补当前真正可见定义的spell/arcana知识，再统一计算可发现配方；不调用giveItem、不写领取历史或累计收入、不直接发放金币/物品。原wave、金币、角色/法杖/物品/布局与历史/stat保持。产物发现仍按原规则，未把整份catalog提前公开。
- claimReward仍从当前offers按ID查找，已被替换的旧ID找不到即拒绝且不draw；新合法领取沿既有事务记history/清offers/进ready。dispatch先查results，故同命令重复返回原executed回执，不重复buff/币/历史。本次不改notify隔离、订阅顺序或手工checkpoint结构。
- 已实读unique-reward-recovery两项：wave31/coins781、两range与两coins修复，保首卡和输入checkpoint、保build/history/stat、新可见定义发现、后续恢复深相等；旧ID拒绝且rng不变、新合法领取重复checkpoint不变；unique/empty不变rng。只读核对`../../work/wand-defense-unique-reward-recovery.log`尾部tests2/pass2/fail0、无取消/跳过，归根执行证据，未重复运行或认定实际用户存档已被写入。

OnHitSpec等共享typed optional尚不表示engine/index与projection接线已完成，后续根两处需另行release窄审；当前运行时克隆测量及UI性能也不在本段验收范围。

## 事件摘要订阅与通知隔离架构窄审（2026-11-04）

结论：RuntimeSummary/subscribeEvents及runtime通知、main与Agent连接的本次源码复核通过，无新增P1/P2。根为性能取证CPU窗口尚未运行新增3测试，本审查仅实读用例，不同时跑测试或全矩阵；只更新审计，无实现修改。

- RuntimeSummary是id/phase/wave/revision/gameTimeMs五个标量，不包含嵌套state引用。RuntimePort方法可选，实际GameRuntime必备；旧适配器不被迫实现，createBrowserConnection优先事件摘要、缺方法仍回退原subscribe。连接仅收集events，真正上传仍getState后经公开projection，不把摘要误作完整帧或放宽内容知识边界。
- state/events监听统一注册在同一个有序Set，每kind+callback去重，off捕获对应entry，和原callback Set重复注册/任一off移除该注册的语义一致；同callback跨两kind属于独立注册。每次notification以完整state/events深拷贝入队，再按该批注册顺序分发，不把两类监听分成先后两轮。已展开监听列表的新增/注销行为保持原实现语义。
- fullstate监听继续收到每人独立深拷贝；events监听每人得到独立事件深拷贝和从该notification.state提取的新摘要对象。回调改summary或事件不能污染其他监听、runtime或队列；前一监听重入dispatch产生的state2排入新notification，当前后续监听仍看到state1对应摘要/快照。异常仍逐监听捕获，finally解除notifying，未取消已有重入保护或共享可变全状态来换性能。
- main只将存档订阅换为subscribeEvents，shouldPersistRunChange仍只需phase和新events，game.restarted解锁gate及非battle durable callback条件保留；save读取完整checkpoint，波起点/非battle持久化策略未变。pagehide/HMR和初始保存路径保持，不因事件摘要额外保存战斗帧。
- 已实读event-subscriptions三用例：混合监听重入顺序与state1/state2、摘要字段/事件/fullstate变更隔离；3个full监听对比1full+2event时完整state克隆计数4→2；同callback重复注册、注销与dispose后不再接收。该4→2是用例的预期且与源码路径一致，截至本段未执行，不能写成测试已通过。

根当前低实体真实3订阅profile报告notify clone占tick约65–75%，另在取敌均26/峰弹113等压力证据；本审查未重复量测，事件订阅减少复制不直接等同于已验证FPS收益。advanceEnemyStatuses/settleDeaths的新engine接线与尚未完成的status projection白名单需另批复核，不以本通知架构通过宣称新状态机制已全部完成。

## 状态效果公开投影与根引擎接线补审（2026-11-04）

本段在根新增status projection后补齐上一段明确未涵盖的两处接线；源码窄审通过，无新增P1/P2。只读根实现、新用例及必要的status emit/伤害调用契约，未重复Battle Sol领域测试，不占其性能窗口运行矩阵，也未改源。

- projectEnemyStatus不spread存档状态，只显式构造正有限slow multiplier/remainingMs及最多4个有效burn的damage/tickMs/remainingMs；burn定义仅在已知spell/arcana集合中才输出。返回新对象/数组，不透出状态ID、原施法者/物品ID、sourceLuck、tick内部游标或任意附加字段。缺status旧实体返回undefined，对既有snapshot兼容；投影不把原onHit配置包随entity暴露。
- statusApplied/statusExpired/knockback及周期damage只通过公开事件类型与固定字段白名单，sourceKind仅status，statusType仅slow/burn/knockback，数值须有限。已检查实际emit契约：burn apply/expire/periodic都含其definitionId作为effect，因此未知effect时statusId也被过滤，避免burn ID编码的隐藏法术名间接透出；slow到期无effect，其合法ID仅slow:target不含施法来源。未知额外secret与状态来源luck不因新字段透出。
- 根stepBattle先推进敌行动并做territory归零败北检查，再advanceEnemyStatuses并立即settleDeaths，之后才恢复与其他弹体/施法。状态不绕过败北、暂停/背包/phase gate或模拟step，也不再次乘speed。burn通过共享damage发真实致死事件，transition的pendingKills捕获原来源，紧接同一死亡结算负责XP/金币/loot并移除敌人，避免另起奖励路径或历史事件重放。普通接触miss直接返回，只有真实正伤害且敌仍活才applyOnHitEffects，周期伤害不重掷accuracy/critical或再套on-hit。
- 已实读新增projection最后用例：unknown burn spell在status与event中均不可见，slow/burn公开数值保留，投影slow修改不影响输入；亦读取status-integration的真实wind/slow/burn及miss断言。Battle此前独立3/3通过来自根报告，新增projection和miss此时未执行；本审查不把源码审通过表述为测试已通过。

本轮不涉及新UI状态图标、全量/build/TS最终验收或实际FPS量测；最新相关测试待根可用窗口统一执行后再补记录。

## 隐藏战斗面板memo与画质设置集成静态审查（2026-11-04）

结论：当时AppMemoBoundaries/App候选、graphicsSettings、MenuPages/MenuSettings及消费者集成源码窄审通过，无新增P1/P2。UI Sol已审叶子，本轮补集成边界，不重复视觉/CPU测试。**最终memo候选已撤回**：根未得到有效浏览器A/B，已完整删除AppMemoBoundaries及App wrapper接线，不计入最终优化；其余App改动未回退。下列memo分析仅为当时已撤回候选的审查历史，不代表交付仍有该边界或证明性能收益。仅修改审计文档。

- memo comparator仅在相同run、前后均battle且前后active=false时跳过父props更新；Inventory的active包含战斗中背包打开且无菜单，打开背包/关闭菜单重新可见必然接最新props；离battle或切run也不能复用旧快照。Inventory另以run作key重建，正常同run隐藏保留原分页/布局组件实例，不因每tick重挂；恢复更新仍走原角色/分类/目标测量effects。WandBoard本来battle全inert且不可见，其最新状态在离battle时恢复。Battlefield、角色mini、CharacterPage和Menu没有包入该边界，仍消费最新state；未暂停runtime或改通知顺序。
- graphicsSettings是独立localStorage偏好store，不进GameState/checkpoint。读取时校验preset/布尔项、bloodBudget夹0..96整数、resolution归.5/.75/1；命名preset与字段不符改标custom。setPreset整组应用，单项更新/显式自定义保存custom，刷新可恢复；同值不publish避免无意义通知，写失败仍保内存有效。storage事件更新不回写，跨页同步无反复写入环；默认medium值与medium预设一致。
- Menu画面页的低/中/高/自定义、血迹开关/数量、死亡残影、尾迹、命中效果、区域细节及特效分辨率均连到实际store setter。公共Select/Switch/Slider/Tabs字段校验与受控值一致，设置分栏保留菜单暂停/恢复、inert与焦点逻辑；MenuSettings用最小尺寸、可收缩列与窄屏覆盖，无新玩法操作。原reduceMotion/textEffects/音乐偏好另key保留，音乐源未接入有明确文案，不把只保存音量偏好表述为已实际控制音频。
- consumers只影响绘制：blood/budget裁displayMarks而不删latest/memory或改变保存；death关闭时仍推进事件cursor并清装饰，impact关闭过滤命中粒子但保heal/shield反馈及游标，尾迹只控制额外子图；areaDetails只关spikes/motes等细节，真实区域基础coverage/进度/实体保持。Projectile/Beam/Chain/Area与状态装饰均传effectResolution，MagicEffectArt再规范化三档并加入共享cache key，固定源像素按档缩放、实际显示尺寸不变，当前有限上限为15种×4槽×3档=180资源。没有修改engine实体、攻击/命中/射程/随机流/模拟时钟。
- 血迹此前“非battle paused存档整片历史图不显示”的补查项现已实读关闭：队列gate为phase非battle或未paused，effect依赖含phase，准备/奖励/败北可渐进显示、active battle paused仍冻结新挂载。每帧4、water/eviction/run取消与完整存储语义保持，不把画质关闭当作删掉血迹数据。

根报告本批14项相关测试与local TS已通过，本审查未执行或读取未提供的测试日志，不将其扩大为最终整仓check/旧registry全绿或真实交互验收。当前浏览器A/B由根/作者占CPU取证，本轮没有截图、运行测试/构建或写生产源码。

## 菜单返回、局部滚动与已知配方手册批次静态审查（2026-11-04）

结论：已实读最新MenuPages.tsx、MenuPages.css、MenuSettings.css及HelpManual.tsx/.css，源码窄审通过，无新增P1/P2。UI负责人已做源/DOM检查由根报告，本审查不重复截图、CPU或实际交互验证，只更新审计。App角色stage可用区域居中尚由owner修正，待sourcefreeze后单扫小差异，不把中间CSS当最终验收。

- 全菜单只有公共顶部header左箭头，无X与底部返回按钮；点击和未被子控件消费的Escape均调用goBack。menu/legacy character/null关闭回游戏，graphics/music/controls/debug/accessibility回settings，settings/help/agent回menu，标签对应层级。Esc尊重defaultPrevented并阻止继续冒泡，避免Select等控件已处理Esc后又退两层。原菜单关闭动画/inert/暂停恢复仍走App既有close，不新增玩法命令。
- menu/settings选项共用MenuLinks，列表项之间用公共PencilLine，不另画分隔器。菜单根为header auto加body minmax(0,1fr)两行，overflow隐藏约束外壳；settings/help内部再用tabs auto加局部panel滚动，header和tabs不随长正文滚走。Agent保持原组件挂载，所在局部区域滚动，inactive仍inert/aria-hidden。CSS用min-width/min-height与窄屏列约束防撑开；paper/ink/muted沿主题语义，不加暗色专用硬编码背景。此处为布局源码检查，不承诺实际所有屏幕像素无溢出。
- Help只展示knowledge.recipeIds中已发现路线，未知路线只报数量；MagicToken先known判断再取定义名称/图稿，未知材料或产物显示“未知”且不调用图标，未知产物归neutral不提前泄露元素。原recipe.name不直接渲染为未知产物标题，React内部key也未输出成公开DOM属性。已知图稿使用共享MagicPresentationIcon，无自写笔刷或按格重复绘制。
- prerequisites只从已知输入寻找已发现前置配方，并用visited阻止环；details未展开不挂详情及递归子树。recipes/grades/arcana各内容由activeTab条件挂载，arcana示例compile也仅该tab计算；根已关闭帮助时卸载HelpManual，不让隐藏大树继续绘制。短标题/材料名/品质/提示用PencilText，长说明保留普通段落。宽屏groups采用auto-fit多列，窄屏单列并允许公式换行，不把全手册做一个不可滚动的大图。

本轮无生产源码修改或新测试执行，最终导航真实DOM、暗色视觉和角色居中小diff由根/owner收敛后补证据。

### 中央workspace与天赋滚动链CSS补审

根随后确认App.css尾部shared ready-area/workspace变量与TalentPanel.css修正已落，本审查只读当前两份CSS及必要的Battlefield环尺寸/PanelBackdrop结构，未发现新增P1/P2。只审本版本静态几何及约束，owner仍在做实际DOM确认，最终sourcefreeze及像素接受不由本段替代。

- 以当前scene高度H计，ready-center=(H+top-bottom)/2，workspace-height=max(0,H-top-bottom)，stage top取center再translateY(-50%)，非负可用区域正好落在top与H-bottom之间，与同一ready中心一致。下界扣defense bottom、vitals高度、12px、heroDiameter及额外12px，给经验环上方留12px；560px断点hero clamp与Battlefield一致，600px断点增加top容纳第二行HUD。inventory改变scene bottom时，百分比中心跟实际scene缩短，padding公式也扣scene-inventory-space，不固定用整屏中心。
- 所有尺寸用border-box；stage给height/max-height与min-height0、单个minmax(0,1fr)网格行，覆盖此前固定inset的top/bottom。角色content/PanelBackdrop/其content逐层允许收缩并max-height100%，最终panel内容overflow auto，overscroll contain；动态padding按剩余区域夹0..40、panel内至多16，不以固定40px把短屏内容挤出可用区。没有改App显示/指针门控或背包布局数据。
- Talent专门将backdrop撑满可用高，包裹层grid与overflow hidden传递可收缩高度，talent-panel自身auto标题+minmax(0,1fr)正文，waves min-height0/overflow-y auto，长历史只滚列表不滚走标题；非Talent面板仍由通用panel content滚动。极短屏可用高被夹0时不产生负尺寸，本段不承诺任意零可用空间仍能显示内容。

根报告最新整仓448/448与registry兼容TS已通过，旧fixture抽取顺序断言已修、无生产失败；本审查不重复执行。顺手读取的旧final-tests.log当时仍425/425，未拿该旧日志冒充448实核证据，最新448与registry TS明确归根报告。DOM/最终UI freeze仍由owner/根收敛。

### workspace最终冻结差异收尾

已只读复核最终尾部workspace-bottom/top/height及top夹紧公式，未发现新增缺陷。bottom=max(0,H-ready-area-bottom)保持环上边界；top在常规ready-area-top与“不低于HUD inset、争取距bottom72px”间取小，height再夹非负。正常空间足够时退化回此前ready-center；不足时中心随新上下界向上回退，底边仍贴workspace-bottom，不向下越过经验环间距。72px是回退目标，并非硬撑高度：根明确320×568背包场景只余56px紧凑窗口，保环边界，完整交互需专门的小屏设计；本次不把该已知限制当作完整小屏可用性保证。原min-height0/max-height/内部滚动链保持，未改HUD位置。

Help最后CSS补minmax(0,1fr)列、tabs/content min-width0/max-width100%及420px间距收缩，静态上消除grid隐式min-content撑宽路径，未改知识过滤或懒挂载。根转述UI作者实际DOM验证：桌面及320×740、背包开/关三stage中心对齐并留12px环间距，36条历史末项可达、角色点击通过，Help窄/宽最终复验无溢出。本审查未重复这些DOM/截图/CPU检查，只将其归为作者执行证据；sourcefreeze后的本轮静态收尾通过。

### 根最终交付状态

根最终报告448/448、registry TS、local TS及Vite build均通过，git diff check通过；日志位于`../../work/wand-defense-final-settings-*.log`。菜单/Help/stage已冻结，实际DOM验收依据上文作者报告。未取得有效浏览器A/B的隐藏battle memo候选已完整撤回，不计作优化成果；此前对该候选的静态通过不改变此最终处置。本审查按根要求仅更新记录，不再读生产源码、运行检查或复测；最终结果明确归根执行与交付报告。

## 奖励刷新、幸运与采集经济根集成窄审（2026-11-04）

结论：新一批rewardRefresh、runtime/index/initial/contracts、engine金币接线及Agent协议投影源码复核通过，未发现具体P1/P2。内容采样与构筑经济领域由既定Sol独立审，本轮核对其共享helper契约及根调用，不重复领域测试。仅更新审计，无生产源码修改、CPU压力/截图或全量运行；尚未冻结的UI刷新/角色/库存消费待后批。

- 免费次数按floor(wave/10)，normalize只在wave变化清freeUsed，paidCount与refreshCount跨波保留。报价为纯函数，不抽数/扣款；免费优先且不推高付费次数，付费按1/3/9/27…指数并有安全整数上限，超限nextPaidCost为null但有免费余额仍可刷新。缺失旧字段与非法计数默认0，同波存档不重置，initial显式置零，restart新局恢复初始值。
- refresh事务先验证reward阶段、非空offers、当前首卡offerId与可负担报价；抽样使用局部rng变量，只有正好4张且语义unique才提交state。阶段/token/余额拒绝或候选不足均不提交随机流、费用、计数或卡片；外层仍缓存命令回执，拒绝不视作玩法状态改变。成功统一扣费用、写rng/counters、按refreshCount给新卡ID、发现真实可见magic并更新recipe知识，然后发refreshed/offered，最后统一revision/receipt/notify。异commandid重复旧offer被token挡住，同commandid直接原receipt，旧claim找不到被替换ID不会误领新卡。
- 刷新在reward非战斗，main既有持久化入口保存完整counter/cards/rng/receipt；重载同组不重复抽样或重置付费阶梯，跨波免费预算重置只由normalize处理。刷新不调用grant/claim、不写奖励历史或累计获得，费用支出不经过采集入账helper，不消耗/改变小数carry。
- 幸运与采集buff进入claim与snapshotRewardOption历史白名单；luck只加state.luck，采集加runBonuses.gatheringPercent，领取receipt阻止重复加成，恢复只读取状态/历史不再应用。施法attackRoll.sourceLuck来自final.luck个人贡献，不含全局state.luck，击杀币与loot再分别加state.luck一次，没有全局幸运双算。
- grantCoinIncome是击杀币、清波币和金币卡的唯一正收入入口，各源只调用一次。队伍采集汇总个人base与有效双向所属equipment，角色ID去重，run采集只加一次，不再乘队伍人数或混用sourceLuck。helper不消费随机流或自行写event/stat，有限值/余额/溢出拒绝在变更前完成；小数carry持久保存至后续正收入，不把支出或零掉币判定变成采集收益。旧档缺字段以0处理，保留原合法小数余额；restart清carry与run加成。
- 引擎event.coins取helper实际amount，runtime战斗统计只计该tick正余额差一次，不再从击杀与清波event重复加；金币卡统计直接granted.amount，history保留原卡base amount。所有支出路线直接扣balance而不倒扣coinsEarned、不受采集倍率折扣。已阅读真实击杀+清波carry用例（2+7实际到账9、统计9）、金币卡10→11及付费refresh不改carry/stat断言。
- Agent parser仅收合法offerId与通用命令ID，不接受客户端费用、次数或随机数；投影公开同一报价与采集贡献数值，装备采集经原属性白名单，run字段显式列出，未透出carry/rng或未知catalog。refreshed事件仅wave/cost/paidCount/freeRemaining等数值白名单，实际新卡仍按发现知识公开。未改runtime订阅隔离/重入顺序以换取性能。

本审查只读核对根`../../work/wand-defense-refresh-focused.log`为16/16、`../../work/wand-defense-economy-integration.log`为6/6，均fail0、无取消/跳过，未重新执行。相关用例已读免费/付费/跨波/刷新恢复、stale claim/offer与幂等、幸运采集历史、真实收入/carry及新局清零；不能将这些定向结果或此前448项扩大为本批新整仓/最终UI通过。最终全量由根统一安排。

### 开战/复活刷新计数同步补审

根首轮全量467项中462通过、5失败，报告其中4项为wave变化后rewardRefresh.wave未同步、constructor恢复时normalize改变快照，另1项为目录新增第9件采集符而preview测试仍固定8。已只读确认根在startBattle返回后、复活设置failedWave-1后各同步normalizeRewardRefresh；使用原rewardRefresh作为输入，所以仅wave/freeUsed按新波次重置，合法paidCount与refreshCount原值保留，无金币/RNG/报价抽取副作用。两处都发生在统一receipt/notify前，开战保存起点与随后constructor恢复现在采用一致的计数表示，不通过放宽等价断言掩盖差异。

亦已读preview断言改为Object.keys(demoContent.gear??{}).length验证当前全装备目录，仍要求真实grantedGear和gearKinds均覆盖，而非删掉赠品完整性校验。根正在定向回归后再做整仓，截至本补审不宣称467已全绿；本审查未重跑测试或改源，只补审计，无新增P1/P2。

## 角色、库存与奖励刷新冻结UI批静态验收（2026-11-04）

结论：当前冻结CharacterPage.tsx/.css、InventoryDock.tsx/.css、RewardChoices及App刷新报价/定位、MenuPages.css集成静态复核通过，未发现具体P1/P2。仅更新本记录，不修改生产源码，不做浏览器/截图/CPU或测试，根最终test/build/registry由根统一执行。

- 角色六tab职责独立：overview短摘要，Radar十轴直接取共享stats.final或其明确变换（攻速为cooldownMultiplier倒数、法力为maxMana），轴值保持真实单位、参考区间独立且超出自适应；未拼造归一化“属性分数”。属性行取同一stats来源，历史法力无法拆分时明确combined/—而不虚构基础/本局。采集单行用getGatheringStats全队helper及base/equipment/run三来源，不拿当前单人值或把run重复乘队伍人数；元素仅独立tab，途径只显示当前角色pathway的已知sequence。
- 属性Tooltip使用公共受控Root/Trigger/Portal，行可聚焦并含来源说明；pointer记录打开前状态、click阻止默认后切换，避免focus先打开使首次touch反而关掉，键盘清pointer快照。十个来源说明与Radar参考值一致，六tab列有显式320px与受可用高约束的overflow，保留小屏可收缩内容与scroll链；源码阅读不冒称新增真实触屏验证。
- 库存四类同一measure/边距与48px cell计算（扣公共8px padding）、同一5行viewport高度/board额外空间。分别保spell/equipment/gear/supply布局缓存，未测有效宽前不提交布局，仍按原位置优先投影；只有用户点击整理才新建紧凑布局。各类共享最大rows/页段，pageCount收缩时clamp，分类与显式换页先cancelDrag；没有借统一宽高重排全部库存或丢手工位置。法杖整体bounds预览、外置clear actions、overflow visible与独立pointer/z层保留，不靠遮挡层吞按钮。
- App用getRewardRefreshQuote当前state直接传刷新按钮，按钮disabled由同一canRefresh及非空offers决定，显示剩余免费或当前真实费用；点击携当次首卡ID，不由客户端递增费用/扣金币。异命令双击旧组仍由runtime offer token拒绝，同命令回执幂等；新卡ID不沿用旧翻面状态，原run:wave组件key保持。reward stage按ready可用边界safe center、可溢出滚动，刷新按钮相对整组下方布局，不改奖励权威或存档时机；Menu根选项也改单列safe居中，溢出回起始滚动。
- 根转述UI负责人真实DOM/runtime UI验证：free1时coins100保持，paid1→3使coins99→96且报价3→9，stale offer无扣款，coins2/price27禁用；26列×5行六根法杖分页5+1、卸载点击可达；角色324px viewport六tab列320px、当前path独立、十值真实来源。上述为负责人执行证据，本审查未重复，不将其扩大为全部尺寸/真实触屏或最终新整仓通过。

本批UI源码审无新增阻塞，最终全量/build/registry结果待根汇总；此前467项中5失败的修复验证状态不由这份静态UI结论替代。

根随后最终报告新批467/467、单回归14/14通过，开战/复活恢复4项与gear目录计数1项失败已实际消除；local TS/Vite生产构建、registry兼容TS及git diff check均通过，日志为`../../work/wand-defense-refresh-final-tests.log`、`../../work/wand-defense-refresh-final-build.log`、`../../work/wand-defense-refresh-final-registry.log`。UI原子刷新联测、角色六页与统一库存DOM通过并sourcefreeze。此为根最终执行/交付报告，替代本批先前462/467与待结果状态；本审查按要求只补记录，不作额外check、日志复测或长追踪。最终静态批审通过，无新增P1/P2，转idle。

## Pages/PWA、持久存档迁移与最高品级赠品新批源审（2026-11-04）

结论：workflow ready后已只读本批实际workflow/script/vendor说明、main/session迁移、PWA及grant扩展与当前max-catalog helper，未发现明确P1/P2。仅写审计文档，未切用户node_modules link、部署、操作浏览器/存档或重跑整仓；根独立clean npm ci及gift负责人测试当时仍在进行，max gift尚未由根显式激活，不能称实际部署/离线安装/当前局新赠品已完成。

- readPersistentRun优先localStorage，只有主键确为empty才读取有效session旧档并尝试迁移。已有合法新局（包括wave0）、rejected原文或暂不可读local均不会被旧tab覆盖；不删除session记录。迁移写失败仍返回有效tab checkpoint供内存继续并保旧tab证据，后续沿main非battle/开战边界保存重试；原unavailable gate与坏原文备份保持。只改变同origin持久介质，通用精确checkpoint及战中刷新回起点策略未变，没有声称能自动跨localhost/Pages origin搬存档。已读取4项迁移测试，未自行执行。
- PWA生产环境才注册，base与scope均/wand-defense/，注册在load后且失败不干扰游戏。manifest id/start_url/scope均相对当前项目，图标和index链接随BASE_URL。SW只拦同origin且项目scope内GET；broker/写请求与游戏存储不纳缓存。没有skipWaiting、clients.claim、controllerchange reload或自动刷新当前run，更新不强制替换正在玩的页面。
- shell预缓存解析HTML直接入口JS/CSS、CSS中同域hashed字体/图片及manifest/icons，全部成功后才替offline HTML；网络断开导航回缓存shell，hashed资源cache-first，导航成功时可安全更新shell。当前已见构建产物是单JS/单CSS与3个hashed字体，符合此直接依赖模型；不把该模型泛称为任何未来lazy chunk/外部服务都已离线。cache按scope前缀区分，shell更新时保护本次依赖并清旧资源至预算；捕获/注册失败仍以游戏在线入口为准。此为源码审，不替代真实安装/断网/升级生命周期验收。
- Pages workflow在main push/手动运行，npm ci后显式选择冻结公开候选包，再test/build并上传dist，部署job单独有pages/id-token权限，主构建contents只读；concurrency不取消进行中的部署。脚本先核SHA256，再解到独立.local临时目录，复用已有可逆inkra-local脚本，不引用开发者绝对路径。正常本机link没有被本审查执行脚本替换。归档README保MIT/第三方/OFL来源与冻结说明，不称私有Host替代方案。
- 已只读计算归档SHA256，完整等于脚本/README的de0c8e9c03929bbb49dc267ce5a64e8773a399b27b153fded1724d6033336239。另对HEAD与当前lock共同package条目核对version/integrity变化均0；排除resolved后仅根package元数据不同，另有1个新增条目、无删除，因此不把整个工作树差异夸称为“所有字节仅换URL”。当前resolved为公共registry，搜索未见内网域/开发绝对路径；clean npm ci实际结果由根另报，本审查不重复安装。
- grantSpell/Item/Gear/Supply现与Wand同样接受可选grade/level，parser枚举与正安全整数校验、runtime复核都在对应写入之前，原local unlock+enabled gate未放宽。Gear/Supply先由工厂创建脱离定义引用的实例再覆盖元数据level并入库，既有品级倍率沿原helper，未凭Lv50另造额外强度公式。普通协议只公开可用字段schema，未放开网络unlock或任意payload。
- 当前max-catalog helper仅显式新request入口可触发，另要求已确认target run（当时仍demo）及精确旧人类unlock receipt；默认旧pending列表不包含新整目录批。只在ready/reward执行，battle延后，defeat也不直接赠送。遍历实际目录各一份mythic/Lv50，法杖单独仅2根5×5空且未装备，旧物品/角色/法杖布局不升级或移动，金币/余数/随机流/进度保持。原toggle先记持久marker，try/finally恢复；每礼物独立成功receipt，失败用后续attempt ID重试，complete guard防整批重发，不把本次新增delta误作全部完成。
- 已读max-catalog测试正常开关两态、全部类别与两根法杖、旧布局/资源保留、重复/恢复幂等、未知激活/无权限/重来/战中拒绝，以及故障单礼物后恢复补齐的断言；负责人仍测试/修改阶段，不抢写preview，也不据源码断言用户当前fresh run目标已最终确认或已收到赠品。实际激活/ACK由根确认后补记。

此前467项及最终UI freeze不覆盖本新部署批，独立clean构建、目标测试与真实Pages/PWA结果仍待对应负责人报告。本轮无全量/截图或新生产源码改动。

### 本批显式授权、实际赠送与clean构建补审

根确认前台fresh存档是demo/wave0/ready、只有spark/amplify且无旧人类receipt，因此本请求新增独立成功unlock receipt。已实读main补接：仅DEV&&hot且env精确匹配user-max-catalog-20261104-01时才取第三参；只demo且ready/reward才发本批unlock。grantAuthorizedMaxCatalog仅本分支接受新prefix unlock或旧既定授权，shared authorizedPreview旧global guard未变；默认apply列表仍不能用本批receipt触发历史3wand/其他赠品。第三参未知request拒绝，重来新run ID不匹配，battle仍延后、HMR/重入guard/完成停止callback保持。此窄审通过，无新增P1/P2；已读新增fresh授权与旧批隔离测试，未执行。

已只读核对`.local/targeted-preview-result.json`实际前台ACK为executed、demo/wave0、mythic/Lv50：33spell+11arcana共44magic、9gear、3supply、2根5×5 wand，expectedTotal与executedGiftReceipts均58，全部preserved字段及restoredCheatToggle均true。这是根实际赠送的回传，不是本审查发放；替代前段未激活/ACK待到状态。根报告发放后立即清理一次性env开关，生产包无preview模块；源码DEV分支隔离已读，本审查未另启用户页面或操作env/存档。

根报告本新批实际全量476/476通过；独立公共npm ci日志已只读核对安装成功、0 vulnerabilities，clean构建日志末尾built成功，冻结包校验/独立link之后的clean生产build通过且原本机link未改。测试476与生产无preview模块归根执行证据，本审查不重复测试/构建。Pages实际run和PWA最终浏览器离线验收仍未完成，不能把clean构建与赠送ACK写成已上线/离线安装成功；后续结果由根汇总。

### 本地生产包真实离线验收补记

根随后报告已在独立本地production origin `http://127.0.0.1:4173/wand-defense/` 使用CUA CDP确认SW activated、scope正确及缓存key独立；仅将该测试tab设为Network offline后reload，真实游戏root、HP、法杖与开始按钮正常渲染。随后恢复online并关闭测试tab，未修改用户实际游戏页面的网络。此为根执行的真实浏览器离线验收，替代前段“最终浏览器离线验收仍未完成”的状态；本审查仅补记录，未自行复测。waiting更新的证据仍为UI负责人早期浏览器测试与后续静态审查，不声称根本轮重测waiting或完成新的安装验收。公共registry与vendor的独立clean生产构建及476项通过沿用上述证据。根准备发布main，截至此补记GitHub Pages实际workflow run与线上部署仍待结果，不称已上线。

### 上一批Pages发布完成

根最终报告：f2e01b7对应首次workflow在npm ci因缺少FreeBSD optional依赖失败；随后依据官方npm同版本1.2.16元数据仅补package-lock 17行，提交c1504e0并push。最终GitHub Pages run 41730796388的build、test与deploy全部success，上一批Pages部署完成，替代前段部署待结果状态。上述为根执行与workflow结果报告，本审查仅记录，未自行复跑或检查线上HTTP；根当时已发起线上HTTP检查，尚未在此提供结果。此前实际58项赠送、本地生产包离线验收及476项测试证据保持各自范围。

用户随后新授权密集战斗性能、合计至少100类型、首屏加载/拆包、召唤建筑主线实装四项工作，根与既定负责人已启动；本审查等待新批边界冻结，不读改该批生产源码，也不把上一批Pages成功表述为新批功能已经上线。

### 新批共享接线与SW v2窄审

相对c1504e0只读复核contracts、runtime部署、compile/cast边界、engine集成、demo目录入口、Agent协议与SW/vite清单接线，未发现具体P1/P2。deployConstruct校验已知实例、双向角色/法杖所属、编译后真实construct、有限0..100坐标及资源/冷却；战中要求显式paused，defeat拒绝，创建成功才一次扣金币/法力与设冷却。容量不足由spawn返回false，不收费；命令仍走原receipt幂等。building不自动施放，summon自动成功一次收费；准备/奖励不推进TTL，清波及开波保留存活友方，失败清理友方。compile复制construct后应用品级/奥术，不修改共享定义；Agent沿已知定义过滤、显式construct字段及轻量事件白名单，没有另起游戏权威。

SW v2以构建bundle生成的pwa-assets.json枚举全部必需JS/CSS/字体/图片，覆盖lazy分块；校验同scope hashed路径，必需资源与CSS依赖成功缓存后才替offline shell，extended字体列optional并跳过CSS预取，实际请求仍沿cache-first缓存。保留无强制接管/刷新策略。静态上补齐拆包后离线依赖链，但这是SW后台预缓存，不能据此声称后台完全不下载lazy资源或已取得首屏性能收益；最终产物清单及新v2真实离线打开懒页面仍待冻结验收。早先v1离线通过不替代该项。

已阅读新增部署3项与目录1项测试断言；4/4及strict TS通过、UI真实runtime部署(75,20)及资源/HP/TTL结果均归根与负责人执行报告，本审查未重跑整仓/测试、截图或改生产源码。目录数量与战斗/构筑细节沿各领域Sol审证据，本轮只核共享契约；性能同源A/B、首屏/字体收尾、最终全量及新批发布仍待根冻结汇总。旧demo-scope中的召唤不合主线限制按本次用户明确新授权覆盖。

根随后报告当前build成功、519/519全量通过；扩目录后5处旧硬编码断言已改按实际目录，仍保留确定性、比例与保留性断言。实际目录为48spell、18arcana、18gear、8items、18monster、2wand templates，合计112种，另39配方。根在独立production origin端口4174以CUA实际确认SW v2 activated、24项缓存、Character/Help lazy已缓存且extendedCached=false；断网reload游戏root正常，随后离线首次打开菜单/帮助手册及合成tab成功，结束恢复online并关闭测试tab。此根执行证据补足前段v2懒页面离线待验项，本审查未自行复测。

首屏主字体实际请求1,569,516B，但前后均约1.57MB，不能将全源码覆盖字体probe约1.74MB称为首屏提升；同步JS最终HTML入口及modulepreload合计仍待根统计，不沿用早期isolated入口25%数字。root每transition懒建敌人ID Map及Battle同cast targets均仍为性能候选；519通过包含当前root候选，只代表正确性回归，mixed同源A/B收益尚待证据，必要时撤回。当前不宣称整体性能完成或新批发布。

### owned推进候选独立窄审

根报告敌ID Map与projectile目标排序两候选因生产1×劣化、5×收益不稳定已撤回，不计作优化成果。新候选将stepBattle与advanceOwnedBattle共用同一private算法，纯入口仍复制、仅runtime.tick使用owned原地推进。本审查已读实际调用：构造checkpoint、getState/checkpoint返回、notify入队和逐listener仍独立复制；排队通知不持有authority引用，事件监听只得标量summary与独立events。引擎同步阶段无外部listener，重入tick只在已有通知快照入队后发生，因此正常有效状态/固定catalog路径未见新增外部alias或旧队列快照共享。

异常原子性并未保持：若引擎中途throw，旧纯入口的临时state可丢弃；owned可能已推进时钟、实体或RNG，却尚未完成revision/统计/奖励/notify。本轮未见正常固定catalog的预期throw路径，已向根明确该语义差异，不将其称为有回滚保证或无条件安全。纯/owned全state与events等价、重入tick的历史快照隔离定向测试及实际收益仍待根补证；本审查未运行测试或改生产源，候选尚不标最终验收完成。

随后已实读runtime新增`content === demoContent`身份限制：仅内置目录走owned，自定义catalog保留纯stepBattle；RuntimePort未增加unsafe开关。已读owned-step三项断言：120tick逐次完整Transition深等价且纯输入不变、checkpoint/监听快照经后续tick与重入setSpeed及恶意listener改参仍隔离、自定义目录getter途中throw后runtime状态等于before。第二项覆盖重入命令而非listener内直接重入tick，不扩大其测试范围。根报告前两项连同既有订阅/部署共8/8通过，第三项当时刚落待跑；本审查未执行。此限制收窄自定义目录异常风险，固定内置目录owned的unexpected throw仍不承诺回滚；源码边界窄审无新增阻塞，实际收益与最终验证仍待结果。

根随后报告owned-step 3/3通过，补足custom rollback待跑状态。已只读核对`.local/work/owned-step-perf/results/{pure,owned}/measure-speed{1,5}.json`：同20秒混合场景、60初始敌人/100初始弹体，1×400次有效调用均值3.976→3.096ms、p95 5.157→4.504ms；5×80次有效调用均值7.198→6.032ms、p95 9.616→8.060ms。每个速度内pure/owned的stateDigest和eventDigest分别一致、均9236事件且missingEvents为空；并非跨速度摘要相同。最大单次耗时两组略升，不称所有分位或单次都改善。结合既有边界源码与等价/隔离断言，接受此固定内置目录owned候选的窄审与本次Node runtime tick均值/p95收益证据；不外推浏览器FPS、普遍收益或异常回滚保证。未自行跑基准或测试，最终整仓仍待根汇总。

### 新批最终构建与测试收尾

根最终报告522/522整仓通过、类型检查及production build通过，日志为`../../work/wand-defense-expansion-final-tests.log`与`../../work/wand-defense-expansion-build.log`，替代前段最终整仓待结果状态。最终dist入口加4个同步modulepreload合计897,890B；655,012B仅入口文件，不能称总首屏，也不据此复述早期25%提升。PWA资源清单18项mandatory与1项extended optional均存在；此前SW v2真实离线懒页面验收与Node tick配对收益按各自证据范围保留。根报告demo-status、mechanism与生成112项内容清单已更新，准备提交发布；截至此记录新批尚无Pages部署成功回报，不沿用上一批run成功为本批上线。本审查仅补最终证据归属记录，未重跑检查、改生产源或重新验收文档内容；共享边界窄审无新增阻塞。
