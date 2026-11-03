# Inkra 本地联调

默认依赖仍是 package-lock 锁定的 npm @inkra/react 0.15.0。
用户已授权本地调试当前修改版，不代表这些修改已经发布。

职责边界：游戏布局、交互、玩法及消费侧接线由游戏任务与用户讨论决定；
Inkra 维护任务只负责如何以通用组件/API/绘制与构建能力支持需求，不接管游戏实现。

先在组件库仓库构建，再在游戏仓库执行：

```sh
npm run inkra:local -- /absolute/path/to/inkra/packages/inkra
```

参数是包含 package.json 与 dist 的公开包目录。脚本将原 npm 包备份到被忽略的
`.local/`，并以受管理符号链接替换 `node_modules/@inkra/react`。
TypeScript、JS 和 CSS 都通过包公开 exports 读取同一版本，不直接 alias 私有源码。
不改 package.json 的版本依赖或 lockfile，不提交机器路径。

切换后重启游戏 Vite。后续组件库完成 build，游戏会读取新 dist；
构建/watch 的具体命令由组件库维护方提供，不由游戏改其构建脚本。
Vite 在本地链接模式关闭 Inkra 预打包，并将 React/ReactDOM 去重到游戏依赖，
允许读取库目录。`import.meta.env.INKRA_LOCAL` 表示此开发/构建是否使用本地包。

恢复原 npm 包：

```sh
npm run inkra:registry
```

然后重启 Vite。即使本地库目录被移动或删除，受管的悬空链接也可以恢复。
未受此脚本管理或被外部改过的链接不会被覆盖。若使用 npm ci 重建 node_modules，
以锁定依赖为准；旧 `.local/` 备份由开发者确认后处理。

当前本地 Progress 已有 stroke 外观、showTrack、fillOrigin、color 和 thickness，
另有 inkDensity（0–2，默认1）、fillOpacity（0–1）、trackOpacity（0–1）公开配置。
浓度改变墨量，透明度仅影响相应图层；宽度使用公开 style.width/CSS布局。
新参数已编译，维护方仍在补专项回归；不把前一轮组件检查当作新增参数全部验收。
普通 npm 模式保留已发布版本支持的布局与涂色适配，不能假定新 API 已发版。

维护方已启动非clean watch：在库根运行 `npm run watch --workspace=@inkra/react`，
当前会话50666，由库维护任务管理；不要重复启动。JS、类型、样式和资源会更新到公开dist。

## 当前预览的一次性赠送

只在本地开发、且操作者明确设置 `WAND_DEFENSE_PREVIEW_GRANT` 请求编号时，
Vite 才向第一个已连接预览客户端投递本局全部魔法赠送；匹配回执后停止。
同请求编号通过 runtime 命令回执幂等，远程 HTTP 仍不能解锁作弊。
用户补齐请求还可设置 `WAND_DEFENSE_PREVIEW_MISSING_ONLY=1`，只增加当前队伍尚未持有的法术/奥术定义，已有物品和装备保持。
赠送结果按实际新增实例数回报，重复请求不重复赠送。
本次用户请求已执行并移除两个环境开关，不会影响正常开局或生产构建。


## 当前库存公开能力

候选包提供 `InventoryGrid.Root`/`Container`，以一个受控拖放域把库存与角色装备槽分开布局，
也可通过 React portal 放入真实角色槽。`canCombine`/`onCombine` 只定义合法候选和释放回调，
实际升品仍由游戏运行时校验并提交。

`getItemAppearance(item, state)` 返回 `{fillColor?, outlineColor?}`，分别应用到整个真实占格的铅笔涂色和边线，
包含异形、旋转及拖拽预览；`renderItem` 仅负责首占格的图标文字，不能用其小内容区域冒充完整背景。
游戏通过同一映射把元素传为填色、品质传为轮廓颜色；普通 npm 0.15 不接收这些候选参数。

库已修复不同缩放容器间的抓取锚点换算，不要求消费者依赖私有传感器。
游戏消费者在独立新局实际验证了 56px 装备槽与完整背包之间的中心抓取双向拖放，
且通过真实命令改变法杖归属；这不是用户当前局的自动操作，也不代表视觉或手机实机验收。
