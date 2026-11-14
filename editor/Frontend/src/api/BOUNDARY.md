# Frontend API 边界

> 目标见 [通信迁移说明](../../COMMUNICATION.md)。Web 消息统一归 api/webMessages.js，
> 原生通信只用一套 V8 绑定；editorApi.js 不再拥有 cefQuery/JSON transport。
> 2026-11-07：所有生产Web能力已迁入具名V8，通用manifest/Bridge/invoke/on/off已删除；完整运行验收仍在执行。

`src/api/editorApi.js`提供Vue公共聚合接口。参数、直接领域返回值和上下文生命周期由C++具名契约定义，
不增加通用invoke、data解包或旧入口回退。场景观察由sceneReader在Web采样，editorApi.off只取消本地token。
窗口/聊天事件的原生disposer交viewLifetime管理。Vue不持有底层Camera/Geometry/Actor/Scene对象。
Python/ScriptRuntime的独立清单与接口不是Web回退。下方续批记录中的数字仅对应历史源码。

## 约束

viewport.configure(scene,cameraId,{archive_session,mode?,calibration?,bounds?}) 原样引用 corona.viewport.configure；
合并视口边界、2D/3D UI 模式与光场标定，不传数字句柄，不调用旧 Fast 或 JSON transport。
返回实际配置领域快照；原生校验全部字段、精确相机及归档 lease 后才写入。
mode 为 flat2d/stereo3d，calibration 为 pe/angle/offset/parallaxScale，bounds 为 x/y/width/height/renderWidth/renderHeight。
视口配置只携带 mode/calibration/bounds；原生光标叠加层已删除，光标由浏览器/系统绘制，不再有 pointer 或 systemCursorHidden 往返。
只允许本页面的 bound viewport，native context ID 不由 Web 提供；清理不得覆盖新 context 或其他窗口的 owner。

- 新的原生能力进入 C++ typed V8 契约及 caller 校验，再在 `editorApi` 中引用；不得扩展旧 JSON transport；非 Web adapter 依其独立契约保留；
- `services/` 可以组合 `editorApi`，但不得复制 transport、schema、revision、错误
  或事件协议；
- 历史 `utils/bridge.js` 已删除，不能重新引入第二套 API；
- 低延迟视口/输入只使用现有 typed V8 契约，不恢复旧 bridge；
- `webDocument.js` 为每个文档缓存冻结的 owner/role/generation/windowId，hash 参数优先于 search；带 uiOwner 的文档即为 peer，缺少 owner 的 peer 启动报 INVALID_SCOPE；
- 场景变换采样统一调用 scene.readTransforms，不再绕经重复 manifest read 路径；不存在其他manifest-backed Web方法；
- API key、Agent runtime、Scene/Actor 权威状态和 Python 私有模块不属于本目录。

## 删除条件

公共方法只能在 manifest、Python adapter 和 Vue/service 调用方完成迁移，并通过契约
回归后删除；外部旧宿主 alias 不属于当前支持范围。

readActive 返回原生快照，不含 transport data 包装。tree_revision 和 selection 的
source_camera_handle 为十进制字符串。selectActor 使用该 context 最近读取的 archive
session 校验原生归属；存档替换或未读取时拒绝。CameraView 传递 opaque_handle，禁止 Number 转换。

setActorTransform 只接受 archive_session 与 position/rotation/scale 三元有限数值数组，
至少更新一个字段；归档身份在 owner 执行时校验。返回实际变换、Actor 标识及递增版本，
没有 transport data 包装；无 persist、数字 operation 或 Fast 旁路，旧 CEF manifest 路由拒绝。

setActorProperties 是状态、物理、摄像机锁定的唯一 Web 属性 patch。必须显式传入
archive_session；顶层字段为 visible、follow_camera、mechanics、camera_lock、animation_sources。
mechanics 使用具名 mass/restitution/damping/body_type 和三个布尔值的 linear_lock/angular_lock；
camera_lock 必须包含 enabled，可附 position_offset/rotation_offset 三元有限数值数组。
所有字段校验通过后才修改，成功一次 patch 只增加一次 Actor/tree revision；返回原生属性快照。
动画源仍异步加载，requested_animation_sources 只表示接受的源请求，不表示加载完成。
不保留 setActorState/setActorPhysics/setActorCameraLock Web alias；其原非 Web 契约共享 typed 写操作。

getEnvironment(scene,{archive_session}) / setEnvironment(scene,patch) 是唯一 Web 环境读写。
patch 顶层只接受 archive_session、sun、grid、physics；sun 使用 enabled/direction，grid 使用 enabled，
physics 使用 gravity/floor_y/floor_restitution/fixed_dt。至少包含一个非空更新组，方向/重力为三元有限数值数组，
标量须为有限 float 范围数值；未知字段和无效混合 patch 在写入前拒绝，省略字段保持、false 有效。
原生 owner 执行前复核 scene/archive，返回实际环境领域快照，不含 transport data 包装；
环境更新保持原 tree revision 策略。authored_lighting 属于资源/存档，不在 live Web DTO 中。
删除 sceneTools 下 getEnvironment/setEnvironment/sunDirection/floorGrid/getPhysicsParams/setPhysicsParams，
六个旧 CEF 路由拒绝；Python/ScriptRuntime 独立 adapter 保留原权限与结果形状，共享 typed 原生操作。

focusActor(scene,actor,cameraId,{archive_session}) 只执行一次原生聚焦应用，actor 为 GUID/名称，cameraId 为精确 ID；
不接受相机显示名或句柄替代 ID。归档/场景/Actor/相机执行前校验，返回实际 center/distance 和 camera 姿态，
camera.opaque_handle 为十进制字符串，无 Number 句柄、transport data 包装或结果轮询。
SceneBar 发布 camera-pose-applied，主页面复核 archive/scene/camera 后取消旧输入并同步 UI，不能再次提交姿态。
移除 sceneTools.focusActor、resourceSearch.focusActor、computeActorFocusPose 及 focusPoseResult 事件和 Python 包装；
非 Web SceneTools.focus_actor 仅按原 Python 权限保留边界适配，内部复用同一 typed 原生应用。

captureScreenshot(scene,cameraId,{archive_session,path?}) 是唯一 Web 截图入口，直接 V8/owned DTO。
scene/cameraId/archive_session 必须为非空字符串；cameraId 精确匹配 ID，不接受显示名或句柄。
path 省略时打开原生 PNG 保存对话框；指定时为非空、不含 NUL 的路径字符串，未知字段/空值拒绝。
返回 status、archive_session、scene、camera_id、path；取消为 canceled/path 空，不执行保存；原生失败为带 code 的拒绝。
执行前与模态选择后复核归档/相机身份；保存只使用当前相机，不修改姿态、输出模式或离屏状态。
删除 sceneTools.selectScreenshotPath/saveScreenshot 和无生产调用方的 viewport.capture；不新增别名或回退。
三个旧 CEF 路由关闭，Python 原权限保留；离屏相机配置属于非 Web 语义，和现有相机保存共享同一原生保存函数。


相机姿态/窗口配置只调用 editorApi.scene.setCameraProperties(scene,cameraId,{archive_session,...patch})，原样引用 V8。viewport.setCameraPose、sceneTools.updateCameraView 和 cameraMove 已删除。局部回复合并到已有 UI 相机，不能丢失渲染元数据；失败不重试旧路径。
该 patch 不接受 view_open，几何/速度更新使用独立 ViewSettings，不覆盖窗口 owner 的开关状态。
scene.createCamera(scene,{archive_session,name?}) 只创建场景相机对象，初始 view_open=false；
appService.createCameraView 再请求原生表面，打开/关闭只走 corona.window，不恢复 sceneTools 开关包装。
三个旧相机 CEF 路由拒绝，Python 的独立适配及原权限保留。

相机重命名和删除只调用 `scene.renameCamera(scene,cameraId,name,{archive_session})` 与
`scene.deleteCamera(scene,cameraId,{archive_session})`。两者要求观察到的归档和精确 camera_id，
由原生 scene owner 校验只读、重复名称、最后一个/主相机保护并维护窗口凭据；旧
`sceneTools.renameCameraView`、`sceneTools.deleteCamera` 仅保留 Python caller，不再作为 Web facade。


无人使用的 moveActorMesh / meshMoveResult Web 通道已删除：无 onMeshMoveResult 订阅、无该结果触发的 takeViewportResults 轮询。Mechanics 原生碰撞移动仍保留，不能作为普通 transform 写入的别名。视口拾取（viewport.pick / 旧 pickActor / actorPickResult）已整体删除，等待重新设计；`viewport` 命名空间只剩 configure / captureScreenshot。


readActorIndex(scene,{archive_session}) 是具名直接 V8 读取，仅允许非空场景和已观察的 archive_session，未知 scope 字段拒绝。
回复为 archive_session、scene、tree_revision、actors[{actor_guid,name,type}]，没有数字句柄、相机或几何体。
无文件扩展名时 type 保留原 actor_type。读请求不懒创建世界，不改变选择/树 revision，不读取完整场景的渲染设置字符串。
CameraView、MainPage 的索引刷新及 NodeGraphWorkspace 运行目标校验复用此投影；迟到结果按归档/视图/图加载及关闭状态丢弃。
MainPage 初始化复用相机/环境/Actor索引投影；SceneBar 的丰富场景树及助手上下文仍属于未完成迁移，不存在新接口失败回退旧完整树的路径。

readActorProperties(scene,actor,{archive_session}) 是 Object 属性面板及主视口变换基线的唯一 Actor 属性读取。
直接 V8 对象返回归档/场景、GUID、名称、字符串 opaque handle、加载状态/错误、模型路径、变换、物理及相机锁定。
不读取 AABB、材质、动画和模型节点；基础属性与 setActorProperties 回复复用同一 native snapshot。
getActor/readActor Web 门面及旧 SceneTools.read_actor CEF 权限已删除，不再用 readActive 为缺失归档补默认值。
Python 的 scene.read_actor 仍保留原完整数据契约。组件必须丢弃归档替换、切换场景、重载和卸载后的迟到结果。

readCameras(scene,{archive_session}) 统一相机列表读取，直接 V8 返回 active_camera_id、相机身份、姿态、窗口状态及渲染开关。
相机句柄仅为字符串 opaque_handle；不包含高级渲染设置 JSON、Actor 几何或完整场景。
MainPage 初始化组合 readCameras/getEnvironment/readActorIndex；CameraView 和 SceneBar 相机悬停复用 readCameras。
scene.getSnapshot、sceneTools.listCameraViews 门面及其旧 CEF 路由退出；Python/ScriptRuntime 原契约保持。
CameraView 窗口路由必须携带创建时观察的 archive，缺失或退休时不重新绑定新世界。
`scene.readTree(scene,{archive_session})` 是 SceneBar 丰富树的唯一 Web 读取入口，直接返回轻量 Actor 行和相机投影；旧 `sceneTools.listSceneTree` CEF 路由退出。NodeGraph 助手仍保留需要变换/物理上下文的 `scene.listActorTree`，不把不同投影强行合并。

模型节点分页和状态写入只使用 `scene.readModelNodes` / `scene.setModelNodeState` typed V8 方法，携带 archive_session 与 actor_guid；写入带 actor_version 前置条件。旧 manifest 方法仅保留 Python caller，CEF 不可调用。

原生 viewport 延迟命令沿用解析相机时取得的同一 CameraCommandAuthority，不另建 Web 通信层。
每个相机独立退休；删除另一相机、vector 扩容或搬移不得让存活相机的凭据失效。
主视口缓存和 CameraView 窗口记录保留该凭据，Optics 在写入和 surface 排他清理期间持有租约。
退休命令即使仍在队列或地址已被复用也拒绝；释放相机时清理待处理 viewport 更新。


2026-11-07：Actor选择统一为editorApi.scene.selectActor，sceneTools选择门面已删除。资源导入使用scene.importResourceFile，普通选择和multimedia结果直接经typed V8；音频metadata含sample_rate/channels，资源ID为字符串。Python导入/音频适配器复用同一native操作，caller权限保持原值。modal导入返回后重新验证archive与场景实例身份，失效选择（含cancel）不得用于新世界。实际交互式对话框/可听音频验收仍未完成。


MainPage 初始化只读取 `scene.readActive()`；不再暴露 `main.onInit` 或空 `main` 命名空间。原 `MainView.on_init` 仅保留 Python caller，Web 不得调用它来隐式加载场景。项目观察通知在使用前核对活动归档；只有通过校验的通知推进刷新版本，被拒绝的旧通知不取消有效在途刷新。


2026-11-07 Scripts迁移：editorApi.scripts的runFile/getRun/stop/getStatus仅调用corona.scripts同名具名V8函数，直接返回显式snapshot，不经manifest、JSON字符串或data envelope。scriptFileService只保留超时回执恢复编排（原requestId查询/重试，未知回执才重试）；Python FileScripts仍是去重、取消、执行状态和场景恢复唯一owner。旧Scripts manifest只保留Native权限。


2026-11-07 ProjectFiles迁移：save/load仅使用corona.projectFiles具名V8；scope与四段identity数组、document/workspace均为owned结构化值，targetArchive不编码JSON key、不解包data envelope。Python存储owner保留原key目录/落盘JSON/原子发布，独立Python opaque key契约保留，旧CEF manifest/handler已删。NodeGraph最终bridgeResult已删。真实packaged UI运行/保存/关闭恢复/重开通过。


2026-11-07 ProjectSettings：readProjectDocument/commitProjectDocument/getActiveProjectInfo/saveActiveProjectInfo直接调用corona.projectSettings具名V8；metadata为显式字段，document content为owned结构化值。Web版本凭据仅SHA256 revision，JSON序列化仅在Python文件owner落盘；独立非Web version原契约保留。旧CEF manifest入口关闭，Python原权限保持；Web调用不再解包data或接受多层metadata envelope。设置面板复用createViewLifetime并带项目revision/请求序号保护，保存携带加载时project_path与archive_session。最终Node717/Python133+56subtests通过；Conan完整构建、真实CEF JSON禁用及packaged五套/11面板通过，项目设置真实Vue保存/重置通过（run-ai8guyqu）。CEF剩82个旧入口；完整优化计划仍未完成。


2026-11-07 FileManager与无消费者入口收敛：corona.files仅getFileTree/createFolder/createActorTemplate/renameItem/deleteItem/openFile六个具名V8操作，显式archive_session/project_path与owned文件树；Web元信息统一projectSettings.getActiveProjectInfo。旧getFiles无消费者不迁移，createFile明确为Actor模板；8个FileManager旧CEF权限关闭，独立Python契约保留。FileManager.vue复用viewLifetime并保护metadata/tree/menu/dialog在途结果、释放window.click，文件双击/菜单打开共用一条路径。ResourceSearch七个Web包装无消费者，namespace删除、CEF关闭，Python schema/适配保持。projectLauncherService脚本清理直接读具名Scripts值，不再data fallback；旧/无效回执阻止切世界。最新Node727/Python108/Engine guard36通过；这些子批仍等待最新源码完整Conan构建与真实CEF/packaged运行验收，不能记为已交付。当前源码旧CEF67，整体计划active。


2026-11-07 ProjectLauncher无消费者清理：Editor740cb2d / Engine397b0a0f。本轮删除browseFolder/getDefaultProjectPath/createProject/validatePortableScene/importPortableAsset/cleanupPortableSceneAssets六个无生产Web消费者包装，旧manifest仅移除CEF/JS alias，独立非Web契约与handler保留。删除scopedAssetPayload/callProjectAssetOperation两个无剩余调用方的scope补全函数。projectLauncherService仅保留openProject的selection、串行队列、旧世界停止恢复与发布编排，删除十二个纯转发方法。实际七个project方法尚未具名迁移。最新源码旧CEF61（Network29/LANChat22/ProjectLauncher7/EditorApi2/CoronaEditor1）；Node727/Python111/guards37/版本16/lint/Vite通过，最新源码Conan与CEF/packaged验收仍待执行。所有文档仅本地，不暂存提交；无push。


2026-11-07 ProjectLauncher读取：Editor d552130 / Engine5bc7594b。版本、最近项目和加载状态直接调用corona.project三个具名V8，显式owned C++ DTO，零参数严格验证；旧三个CEF入口关闭，Python契约保留。RecentGames统一viewLifetime与状态read序号，阻止卸载后创建轮询、迟到写入和迟到导航。NewGame/MainPage直接读加载snapshot。Node732/Python111/guard38/lint/Vite通过；最新完整Conan与真实CEF/packaged尚待。源码旧CEF58，实际创建/打开/文件选择四个ProjectLauncher方法尚未迁移。上一批FileManager/ResourceSearch/Scripts已完整构建及CEF/packaged通过，全部11面板、真实FileManager菜单和真实最小化/恢复通过（run-fp7sp3ip），cleanup_ok=true、Optics失败0。
