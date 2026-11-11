# Frontend Services 边界

> 目标见 [通信迁移说明](../../COMMUNICATION.md)。service 保留领域职责，频道、请求匹配、
> 超时和清理统一迁入 Web 消息模块；原生调用只走唯一 V8 绑定。
> manifest-backed 方法保留各自结果契约，但也使用原生 V8 入口。

`src/services` 是前端 active domain facade 和 UI 编排目录，不是 C++ manifest/schema owner，
也不直接持有 Scene/Actor 或 raw CEF transport。尚未迁移的 manifest 方法仍通过
`src/api/editorApi.js` 引用；已迁移窗口及场景读取/选择/变换的契约由 C++ V8 绑定定义，service 只引用原生函数。
已迁移的 service 由本目录直接承载，外部旧宿主 alias 不再受支持。

## 分类

### Manifest facade

这些 active 文件提供窗口、LANChat、网络、资源和项目生命周期编排；新页面应优先直接
使用对应的 `editorApi` namespace：

`lanChatService.js`、`aiService.js`、
`projectLauncherService.js`。

无生产调用方的 `sceneService.js`、`projectService.js`、`scriptingService.js`、`fileService.js`、
`projectSettingsService.js` 已删除。页面使用 `editorApi` 的明确领域方法，不恢复同义转发门面。

`appService.js` 是 Dock、CameraView 窗口和进程操作的 canonical service owner。
窗口快照、拖动区域、面板创建/关闭/聚焦、detach/redock、相机窗口控制/关闭、
suspend 屏障及关闭请求/完成事件直接引用 `window.corona.window`。
createCameraView 直接传入 archiveSession/sceneId/cameraId，由原生解析句柄和租约；所有窗口方法均无旧 Bridge 回退，DockCommand 已删除。

### 世界界面会话

Story 路由及 StoryWorld 已删除。项目统一为创造世界；`worldModeService.js` 通过
`projectSettings.getActiveProjectInfo` 解析项目身份及就绪状态，旧 mode 字段不改变入口。
同一就绪项目的普通 resolve 复用状态；force resolve 还用于存档重新打开，路径相同也必须
退休旧窗口，不能作为普通元数据刷新而保留旧原生租约。

`editorWindowSession.js` 负责 UI 策略、窗口请求登记、跨窗口会话令牌与过期事件过滤，
通过 `appService.js` 使用直接 V8 窗口能力，保持既有 Dock 设计。
`windowSessionState.js` 只在主文档写权威策略及记录；子文档通过公共 Web 请求逐条提交
save/remove，主文档合并后发布带 stateVersion 的快照，拒绝旧 owner/generation 和过期快照。
策略通知统一为 windowSession.policyChanged，纯记录变动不触发策略通知。
localStorage 不参与会话记录传输，service 不拥有场景数据，也不改写 camera.open。

窗口退休等待未完成请求，并用直接 V8 `suspendCameraViews` Promise 作为两次主线程调度屏障；
排空等待超时仍保持阻塞；原生 Promise 直接报告完成，没有旧 Dock 超时/迟到回调通道；关闭面板前等待该面板发出的请求结束，
避免销毁回调上下文。主窗口使用 sessionStorage 中的 owner，在页面重载时退休原有窗口。
删除该服务前需通过跨窗口、切换及迟到响应测试。

`viewportCalibrationService.js` 的主文档实例拥有活动标定及递增 revision，启动时只读一次偏好。
MainPage、CameraView 和标定 Dock 使用公共 Web request/event 的值同步；客户端拒绝其他 owner、
旧 revision 和卸载后回复，不在收到通知后重读 localStorage。存储失败不阻断活动同步，
未取得初始值的相机不向原生发送默认标定。主文档卸载时注销 handler，所有视图释放订阅；
逐个隔离同步/异步监听器异常，已经接受的标定更新不能被单个视图错误改成失败回复。

`nativePanelHosts.js` 将主页面的面板开关同步到原生窗口，每个面板对应一个 CEF 文档。窗口创建和回收经过 `editorWindowSession.js`，停靠、拖动和尺寸由 ImGui 管理。

### 节点图领域编排

`nodeGraphGenerationService.js`、`nodeGraphReviewService.js` 负责节点生成与审查业务任务。
页面请求匹配、发现、超时/取消归 webMessages；业务模型任务轮询与状态不等同于通信重试。
没有生产调用方的 nodeGraphRuntimeService 已删除；NodeGraphWorkspace 本地运行/保存仍保留。
`nodeGraphSaves.js` 拥有按 archive session 选择 workspace、共享在途保存和失败卸载图的显式重试。
每个文档只注册一个 `nodeGraph.flush` handler；发现、定向请求、超时和取消归公共 webMessages.requestAll，领域层不维护请求 ID 或响应表。
`editorWindowSession.beforeRetire` 通过 appService 调用 active archive flush，保存完成前不进入原生退休；禁用 UI 保留原消息 generation，再次启用才换代。
旧 __coronaNodeGraphFlushers / __coronaNodeGraphFlushSave 和 launcher 全局捕获已删除；图存储自身仍通过既有 editorApi manifest，尚待原生迁移。
active archive 读取已通过 scene.readActive 直接 V8 返回领域值；nodeGraphSaves、scriptFileService、cabbageDomain 不再从 transport data 包装取读取结果。saveBlocklyTarget 等图存储仍待迁移，不将 Web 协调验证等同于原生存储零 JSON。

### Cabbage UI 状态

aiService.js 保持聊天、审查、节点生成、目标规划和评分的页面接口；模型请求进入纯 Web 会话。cabbageChatRequest.js 在发送时取最近 24 条消息、前 20 个任务和前 80 个对象，用同一份快照组装最终消息与展示步骤。引导只在成功完成时发布，替换必须通过消息、引导与取消的等价测试。LANChat 和原生网络同步独立保留。

`cabbageAssistantContextService.js`、`cabbageGuidanceService.js`、
`cabbageTutorialSessionService.js` 负责面板上下文、引导和教程会话；它们不定义 AI 密钥、
Agent runtime、Scene/Actor 权威状态或公共引擎 API。

## 依赖约束

- service 只能通过 `src/api/editorApi.js` 或注入的 UI/store 能力访问跨层功能；
- service 不得导入已删除的 `src/utils/bridge.js`，不得使用 `window.cefQuery`；
- facade 不得复制 manifest 参数校验、错误码、revision、事件协议或状态机；
- 节点图和 Cabbage service 的本地事件/存储只服务 UI 协调，不得变成第二套引擎事实；
- 新服务必须先登记职责、canonical API owner、生命周期和删除/迁移条件，再加入本目录。

## 删除条件

删除任一兼容 facade 前必须确认外部宿主和旧面板完成迁移，并通过对应的 JS/Python 边界
测试；删除节点图或 Cabbage service 前必须先迁移所有组件调用方和持久化/事件回归。任何
删除都不能改变 `editorApi` manifest contract。

AI 业务 owner：aiService.js 保持页面调用接口；aiWorkflows.js 管理业务任务、世界归属与结果校验；aiGraphDomain.js、aiGraphRequirements.js、aiPlanningDomain.js、cabbageDomain.js 拥有业务规则。策略与合同归 aiPolicy.json、aiPrompts.json、cabbageChatPolicy.json 和 aiBlockContract.xml。

aiModelService.js 调用纯 Web 会话；aiProviderRuntime.js 负责 fetch、SSE、配置快照、队列与取消；aiSessionService.js 在主文档持有请求和内存密钥，独立面板通过 BroadcastChannel 共享。本次启动内可跨面板接续请求，重启不恢复密钥或网络任务。设置页只回显掩码。

助手文档内容沿用通用原生 projectSettings.readProjectDocument/commitProjectDocument 保存。AI 不经过 Python，也不定义原生 AI manifest。删除条件：HTTP 参数、流式分片、取消、配置快照、跨面板共享和无 Python AI 依赖回归全部通过。


`creativePanelState.js` 的 provider 验证 scene/camera/opaque handle 并串行调用动作，client 只通过公共主 owner 请求取得快照/动作结果；owner/revision 保护旧快照。
`guidanceCoordinator.js` 协调打开面板和展示引导，公共消息层等待晚注册 handler；没有领域 request ID、ready/accepted 或副作用重试。
`viewportControlsService.js` 将视口 UI 控制定位到主页面；各面板只发业务请求，不持有另一套消息通道。

Actor 属性直接使用 `editorApi.scene.setActorProperties`，不得恢复分散的
state/physics/camera-lock Web facade；Vue 调用方必须传递其已观察的 archive_session。

环境读写直接使用 `editorApi.scene.getEnvironment/setEnvironment` 的 V8 绑定。
太阳/网格/场景物理参数共用环境 patch；独立 SceneControls/EditorSettings 经公共 Web 请求交给主页面执行，
主页面携带观察到的 archive_session，原生失败必须返回请求方，不能吞掉错误后发布成功快照。


2026-11-07 Scripts迁移：editorApi.scripts的runFile/getRun/stop/getStatus仅调用corona.scripts同名具名V8函数，直接返回显式snapshot，不经manifest、JSON字符串或data envelope。scriptFileService只保留超时回执恢复编排（原requestId查询/重试，未知回执才重试）；Python FileScripts仍是去重、取消、执行状态和场景恢复唯一owner。旧Scripts manifest只保留Native权限。


2026-11-07 ProjectFiles迁移：save/load仅使用corona.projectFiles具名V8；scope与四段identity数组、document/workspace均为owned结构化值，targetArchive不编码JSON key、不解包data envelope。Python存储owner保留原key目录/落盘JSON/原子发布，独立Python opaque key契约保留，旧CEF manifest/handler已删。NodeGraph最终bridgeResult已删。真实packaged UI运行/保存/关闭恢复/重开通过。


2026-11-07 ProjectSettings：readProjectDocument/commitProjectDocument/getActiveProjectInfo/saveActiveProjectInfo直接调用corona.projectSettings具名V8；metadata为显式字段，document content为owned结构化值。Web版本凭据仅SHA256 revision，JSON序列化仅在Python文件owner落盘；独立非Web version原契约保留。旧CEF manifest入口关闭，Python原权限保持；Web调用不再解包data或接受多层metadata envelope。设置面板复用createViewLifetime并带项目revision/请求序号保护，保存携带加载时project_path与archive_session。最终Node717/Python133+56subtests通过；Conan完整构建、真实CEF JSON禁用及packaged五套/11面板通过，项目设置真实Vue保存/重置通过（run-ai8guyqu）。CEF剩82个旧入口；完整优化计划仍未完成。


2026-11-07 FileManager与无消费者入口收敛：corona.files仅getFileTree/createFolder/createActorTemplate/renameItem/deleteItem/openFile六个具名V8操作，显式archive_session/project_path与owned文件树；Web元信息统一projectSettings.getActiveProjectInfo。旧getFiles无消费者不迁移，createFile明确为Actor模板；8个FileManager旧CEF权限关闭，独立Python契约保留。FileManager.vue复用viewLifetime并保护metadata/tree/menu/dialog在途结果、释放window.click，文件双击/菜单打开共用一条路径。ResourceSearch七个Web包装无消费者，namespace删除、CEF关闭，Python schema/适配保持。projectLauncherService脚本清理直接读具名Scripts值，不再data fallback；旧/无效回执阻止切世界。最新Node727/Python108/Engine guard36通过；这些子批仍等待最新源码完整Conan构建与真实CEF/packaged运行验收，不能记为已交付。当前源码旧CEF67，整体计划active。


2026-11-07 ProjectLauncher无消费者清理：Editor740cb2d / Engine397b0a0f。本轮删除browseFolder/getDefaultProjectPath/createProject/validatePortableScene/importPortableAsset/cleanupPortableSceneAssets六个无生产Web消费者包装，旧manifest仅移除CEF/JS alias，独立非Web契约与handler保留。删除scopedAssetPayload/callProjectAssetOperation两个无剩余调用方的scope补全函数。projectLauncherService仅保留openProject的selection、串行队列、旧世界停止恢复与发布编排，删除十二个纯转发方法。实际七个project方法尚未具名迁移。最新源码旧CEF61（Network29/LANChat22/ProjectLauncher7/EditorApi2/CoronaEditor1）；Node727/Python111/guards37/版本16/lint/Vite通过，最新源码Conan与CEF/packaged验收仍待执行。所有文档仅本地，不暂存提交；无push。


2026-11-07 ProjectLauncher读取：Editor d552130 / Engine5bc7594b。版本、最近项目和加载状态直接调用corona.project三个具名V8，显式owned C++ DTO，零参数严格验证；旧三个CEF入口关闭，Python契约保留。RecentGames统一viewLifetime与状态read序号，阻止卸载后创建轮询、迟到写入和迟到导航。NewGame/MainPage直接读加载snapshot。Node732/Python111/guard38/lint/Vite通过；最新完整Conan与真实CEF/packaged尚待。源码旧CEF58，实际创建/打开/文件选择四个ProjectLauncher方法尚未迁移。上一批FileManager/ResourceSearch/Scripts已完整构建及CEF/packaged通过，全部11面板、真实FileManager菜单和真实最小化/恢复通过（run-fp7sp3ip），cleanup_ok=true、Optics失败0。

### Network收敛（2026-11-07）

`networkService.js`已删除，JoinGame与lanchat store直接使用`editorApi.network`的八个具名V8调用；没有第二层unwrap门面。LANChat当前仍有十二个通用方法及单一service待迁移，不能据此认为全部联机路径已具名化。

2026-11-07 LANChat方法批：Editor `2f5b3f6` / Engine `6efb719f`。删除 `lanChatService.js`，12 个实际调用由 `editorApi.lanChat` 直接引用具名 V8，store 保留房间状态/业务流程。历史消息 metadata 为对象；LANChat.event 通用订阅与对应事件 metadata_json 兼容解析尚未退役。Network 8 个方法与 LANChat 12 个方法均无纯转发 service；原生/Python 独立 adapter 不属 Web 重复门面。源回归和独立 UI 编译通过；方法批完整构建/真实运行仍待验收。文档仅本地。
