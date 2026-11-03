# 无尽巫师

Inkra 的独立使用方游戏项目，第一版试玩原型已接通。

[在线试玩与安装 PWA](https://inkrajs.github.io/wand-defense/)

源码可查看、学习及个人试运行，其他用途需书面授权。**不是 MIT 或 OSI 开源项目**，详见 [LICENSE](LICENSE)。第三方依赖沿用各自许可证。

## 本地开发

Node.js 22.12+；首次运行 `npm install`，随后 `npm run dev`。
`npm run typecheck` 检查类型，`npm run build` 构建。
浏览器打开 http://localhost:5173。打开背包会暂停战斗，可拖放魔法编排法杖；
邻接奥术改变施法效果。领取清波奖励后再开始下一波。
本地候选组件库还支持同名同品质魔法拖放升品；配方合成目前保留语义命令，
界面入口正按试玩反馈调整，见 [当前状态](docs/demo-status.md)。
准备和结算进度长期保存在本机浏览器的 localStorage，首次读取自动迁移当前标签页的旧存档；开战保存该波起点，战斗中刷新从这一波开头重打，不持续写入中途进度。关闭后重开同一地址可继续，菜单“重新开始”才从第0波开始。
尚无账号或跨设备存档。右上速度控制按 0.25/0.5/0.75/1/2/3/5 档调整模拟速度。

角色独立积累经验与成长，背包共享；每根法杖保留自己的魔法布局，支持3×3、4×4和5×5模板。
当前包含48种法术、18种奥术、18种装备、8种道具、18种怪物和2种额外法杖模板，合计112种定义、39条合成配方。涵盖飞弹、即时连锁、射线、领域、治疗、护盾、有生命值的召唤物及可部署建筑。
天赋入口保存本局已选奖励；失败结算展示累计收获，正常操作为“重来”。
领地可升级上限、按缺失量付费修复，并分别解锁和升级城墙/护盾自动恢复。
自动恢复只随战斗时钟推进，暂停和失败不恢复；作弊复活仍需人类授权解锁后调用。

当前本机试玩使用 Inkra 候选构建联调：完整物品填色、组合拖放和新版线性进度条
尚未发布到 registry 0.15。普通安装有兼容回退；联调方式见 [本地组件库](docs/local-inkra.md)。

## GitHub Pages 与 PWA

主分支推送由 GitHub Actions 自动测试、构建和部署至 `/wand-defense/`。
页面加载完成并缓存资源后可离线启动；浏览器支持时可安装到桌面或主屏幕。
更新不会自动刷新正在玩的游戏，新版本的 Service Worker 等旧页面全部关闭后接管。
本地试玩与线上站点属于不同地址，存档各自独立，不会自动跨站点同步。

复现发布构建：在干净目录 `npm ci`，再运行
`node scripts/use-deploy-inkra.mjs` 和 `npm run build`。
该显式步骤使用带校验和的公开组件包快照，见 [依赖说明](vendor/README.md)，
不依赖某台电脑的组件库路径，也不会发布本地 `.env` 或游戏存档。
Pages 仅托管游戏前端；HTTP Agent broker 仍需单独运行并配置可访问的服务地址。

## HTTP 与 Agent

另开终端运行 `npm run broker`，在游戏右上角菜单中选择 Agent 并连接服务，
将显示的配对码交给允许控制本局的 Agent：

```sh
npm run playlink -- pair <配对码> --url http://localhost:8787
```

配对后使用返回的 sessionId/agentToken，通过 CLI 的 state、capabilities、
content、command、result、events 命令操作；完整说明见
[Playlink Skill](skills/playlink/SKILL.md)。
accepted 仅表示入队，执行结果须查询 result 或后续事件。
正常查询仅包含本局玩家已发现的信息；作弊需人类在游戏页面显式解锁，
不能从网络调用解锁。手机前台需能访问同一 broker，地址可用
`VITE_PLAYLINK_URL` 配置；不保证后台/锁屏运行。

## 设计与开发

- [一期范围与临时选择](docs/demo-scope.md)
- [架构与接口](docs/architecture.md)
- [界面规范与用户确认要求](docs/ui-guidelines.md)
- [任务协调与验收](docs/development.md)
- [当前交付与限制](docs/demo-status.md)
- [机制设计快照](docs/design/mechanics.md)
- [内容数据快照](docs/design/content.md)

设计快照中的「草案」「待定」仍保留原状态；一期临时选择只用于试玩。
界面视觉效果由用户确认，代码与架构由 GPT-6.1 Sol 验收。

召唤物与建筑已接入本版：装备相应魔法后可部署到战场任意合法坐标，战斗时选址会先暂停，取消或完成后恢复原暂停状态。召唤物可自动施放；建筑由玩家选址，按定义消耗法力与金币。

