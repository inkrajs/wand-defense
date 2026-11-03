# 无尽巫师

Inkra 的独立使用方游戏项目，第一版试玩原型已接通。

源码可查看、学习及个人试运行，其他用途需书面授权。**不是 MIT 或 OSI 开源项目**，详见 [LICENSE](LICENSE)。第三方依赖沿用各自许可证。

## 本地开发

Node.js 22.12+；首次运行 `npm install`，随后 `npm run dev`。
`npm run typecheck` 检查类型，`npm run build` 构建。
浏览器打开 http://localhost:5173。打开背包会暂停战斗，可拖放魔法编排法杖；
邻接奥术改变施法效果。领取清波奖励后再开始下一波。
本地候选组件库还支持同名同品质魔法拖放升品；配方合成目前保留语义命令，
界面入口正按试玩反馈调整，见 [当前状态](docs/demo-status.md)。
刷新会从当前标签页的 sessionStorage 恢复本局；菜单“重新开始”才从第0波开始。
尚无账号或跨设备存档。右上速度控制按 0.25/0.5/0.75/1/2/3/5 档调整模拟速度。

当前本机试玩使用 Inkra 候选构建联调：完整物品填色、组合拖放和新版线性进度条
尚未发布到 registry 0.15。普通安装有兼容回退；联调方式见 [本地组件库](docs/local-inkra.md)。

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

建筑/召唤在独立的 [feature/summons-buildings](https://github.com/inkrajs/wand-defense/tree/feature/summons-buildings)
分支并行开发，未合入本版试玩。

