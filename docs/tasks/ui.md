# 界面模块

状态：本轮代码集成与 Sol 局部验收完成；实际视觉效果等待用户确认。最新界面约定以 `docs/ui-guidelines.md` 为准。

## 边界与实现

- 拥有 `src/ui/**` 和本记录；`App` 接收唯一 `RuntimePort` 与可选 `agentPanel`，通过订阅读取状态，所有游戏动作通过 dispatch，领域规则由运行时处理。入口接线由根协调者负责。
- 单一 viewport 战场、波次及金币 HUD、左下角色与背包入口、右上全屏菜单。菜单与角色页使用相同导航和暂停恢复机制；Agent 面板切页保持挂载。角色详情只展示已知序列与当前属性，法杖调整发送 `equipWand`。
- 场地只保留虚线防线；角色位于其上，首角色共享经验环，角色下方为蓝色法力 Progress。防线下方为无数字和外框的盾/红色 HP Progress，按真实值对称收缩。
- 防线下方为首角色当前法杖的 Inkra InventoryGrid 纯槽位。准备及奖励阶段完整尺寸，战斗中线性缩小至 0.1 倍并禁用焦点/拖动，背包提供完整构筑操作；角色/法杖选择、旋转、移除与合成在背包工坊进行。缩略网格不提供触屏编辑。
- 使用已安装 `@inkra/react` 0.15.0 的公开 Button、PencilIcon、PencilText、Progress、InventoryGrid 和 PencilSurface。`assets.tsx` 按内容 `asset.key` 映射文字、图标与可选图片；未制作美术。UI 仍绑定试玩内容目录，未来替换目录时需注入。

## 子任务与验收

- 战场：GPT-6 Luna 原生聊天 `01a1a191-3c11-7661-8968-dc0c66774f35`，负责 `Battlefield.tsx`/CSS 初版；负责人随后集成和调整。
- 构筑与法杖：GPT-6 Luna 原生聊天 `01a1a191-37c1-7632-8d64-453eea817f05`，负责 `LoadoutPanel` 初版、`WandBoard.tsx`/CSS 和角色详情 `CharacterPage.tsx`/CSS；后续在明确文件边界内复用同一聊天。
- 独立 GPT-6.1 Sol 审查原生聊天 `01a1a192-ea95-7d02-888b-8a4fc75bf65c`：本轮最终局部代码验收通过。确认角色知识过滤、装备命令、菜单暂停与焦点恢复、Agent 持续挂载、战斗缩略槽位及场地结构；此前验证 32 组槽位形状旋转映射与阶段 gate。未进行截图、AI 视觉评审或重复全套测试。
- 最近 `npm run typecheck` 通过。浏览器键盘交互与用户实际视觉确认仍待验证。运行预览使用 `npm run dev`，整仓最终验证与提交由根协调者负责。
