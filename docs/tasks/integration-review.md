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
