# HTTP 与 Agent 负责人
状态：实现与集成验收通过。负责人 GPT-6.1 Sol；交由根协调者统一提交，界面效果由用户确认。

## 文件边界与实际派发
- 本负责人：`src/agent/protocol.ts`、`src/agent/projection.ts`、本记录与集成测试。
- OpenCode Go / `deepseek-v4-pro`：`server/**`、`src/agent/connection.ts`。threadId `01a1a191-8940-75a1-8c67-56c61df5c825`，host `local`，operationId `wand-defense-protocol-broker-20261103-01`。已落盘 broker/entrypoint/connection 与10项服务测试；审查发现的关键传输项已修正，Sol实际代码复审通过，已通知停止编辑。
- GPT-6 Luna：`cli/**`、`skills/playlink/**`。threadId `01a1a191-8c89-7bf1-b3e6-848f193a89f2`，host `local`。已交付CLI/Skill；Sol已审查并要求输入校验、CRLF SSE、accepted与gap语义修正，修正后复审通过。
- 共享 checkout，不提交/推送，不修改公共契约或依赖。

## main 接线入口（已派发约定）
`createBrowserConnection(runtime: RuntimePort, config: { baseUrl: string; content?: ContentCatalog; sessionId?: string; browserToken?: string; pollMs?: number; onSession?: (session: {sessionId:string;browserToken:string;pairCode?:string})=>void; onStatus?: (status:string)=>void }): { close():void }`

根协调者在页面启动时显式传入 broker URL 与 catalog；onSession 在人类 UI 展示 pairCode，浏览器凭据仅归游戏端。浏览器主动轮询 broker，不运行第二份模拟。close 在页面退出时取消连接。sessionId/browserToken 可复用重连，不能交给 Agent；Agent 用配对返回的 agentToken。

## 协议与配对步骤
1. `npm run broker`（默认端口 8787，PORT 与 BROKER_HOST 可覆盖），游戏前台通过上面的入口连接 broker。
2. 浏览器 `POST /sessions {}` 创建会话并得到 browserToken、pairCode；UI 展示配对码。
3. Agent `npm run playlink -- pair <pairCode> --url http://localhost:8787`，获得 sessionId 与 agentToken。
4. 后续使用 `--session <sessionId> --token <agentToken>` 或 PLAYLINK_SESSION/TOKEN；状态、命令、结果和事件均需 Bearer。
5. `POST /sessions/:id/commands` 返回 accepted；`GET .../results/:commandId` 确认 executed/rejected。同 id 重试不产生第二次执行。
6. `GET .../events?after=N` 补读；`GET .../events/stream?after=N` SSE。游标缺口需重新获取状态。

手机前台必须访问同一个 broker；localhost 在手机表示手机自身，应使用可访问的电脑局域网地址并配置 CORS。页面后台/锁屏不保证战斗与连接持续。

## 权限和披露策略
游戏端白名单解析远程命令，网络永远不能 unlockCheats；setCheats 需本地 unlocked，cheat 还需 enabled。投影显式枚举字段，移除随机状态、内部计时、未发现定义、未知材料ID与未发现产物ID/详情（已知配方名及已知材料保留）、内部错误与事件任意payload。解锁作弊不等于公布图鉴。

## 调用流程和 Sol 验收
1. 页面 `createBrowserConnection` 向 broker 出站创建会话、上传 `projectFrame` 并轮询待执行命令。
2. Agent 配对后仅用 agentToken 观察/发命令；broker 先记录 accepted，不执行游戏规则。
3. 浏览器 `dispatchRemote` 用白名单校验输入/权限，再调用唯一 RuntimePort.dispatch；结果和新状态投影回传。
4. broker 仅在 executed/rejected 后移除待执行项，重复 id 同 payload 返回同一结果，不同 payload 409。

Sol 已审查两位子任务实际代码及调用流程，结论通过：server 不依赖 engine/loadout，CLI 不实现游戏规则；公共命令继续复用 contracts。投影采用显式字段和内容知识白名单，可在不公开整个catalog的前提下扩展事件及能力。

审查发现并修正：事件上传期间队列变化按seq确认，不再按旧计数删除新事件；每帧最多200事件/200结果；15秒请求超时和有上限退避；初始补种运行时事件；accepted不会完成排队命令；JSON/SSE检测裁剪及内部序号缺口，SSE gap携带可恢复游标。

## 实际验证
- 负责人 `tsx --test src/agent/projection.test.ts`：2项通过，覆盖未知内容/材料/产物/错误不泄漏、已知配方部分披露、作弊解锁不自动公布图鉴、远程权限与字段隔离。
- 负责人 `tsx --test src/agent/connection.test.ts`：真实broker + 浏览器连接 + CLI pair + 真实runtime，1项集成测试通过，覆盖accepted到executed、重复命令幂等、冲突409、跨会话401、角色403、事件JSON与SSE。
- 子任务 `tsx --test server/broker.test.ts`：10项通过，覆盖配对/帧/命令/结果、角色隔离、413、远程unlock拒绝、accepted非完成、裁剪与内部gap、SSE恢复游标。负责人读取了实际测试输出和代码，未重复全套。
- 子任务整仓 `npm test`：40/40通过；负责人最终 `tsc --noEmit` 通过，模块路径 `git diff --check` 无输出。根协调者另执行统一build和真实服务smoke。
- CLI help 与 null 命令拒绝实际验证。按 skill-creator 的 SKILL.md 核对触发描述、frontmatter、真实CLI示例；`quick_validate.py skills/playlink` 通过。未安装全局Skill、未改共享依赖。

## 运行边界
原型会话、命令与结果仅在broker内存中保存，broker重启需创建/配对新会话；配对码有效10分钟。事件队列与broker历史各保留最多2000项，缺口通过gap提示后重新state同步。手机需前台连同一broker，localhost应换电脑局域网地址；未实测手机锁屏/后台行为。本期没有增加生产级资源回收、持久化或性能框架。CORS可通过createBrokerServer选项显式配置，命令入口开发默认允许跨源。

暂无公共依赖/契约变更请求。无provider失败或模型切换；两个子任务均在约定模型上完成。代码未提交、未推送，由根协调者统一处理。
