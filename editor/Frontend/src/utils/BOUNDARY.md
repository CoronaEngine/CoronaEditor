# Frontend utils 边界

> 目标见 [通信迁移说明](../../COMMUNICATION.md)。eventBus 的活动消息归统一 Web 模块，
> viewport adapter 通过唯一 V8 绑定访问原生。下文是待迁移现状，不得新增旧 bridge。

`src/utils` 只承载无领域归属的低延迟输入 adapter 和视图辅助工具。它不是 manifest transport、
Vue 业务 service 或场景状态的 owner。

## 文件职责与删除条件

| 文件 | 类型 | 职责 | 删除/迁移条件 |
|---|---|---|---|
| `cameraDragRegions.js` | active adapter | 计算窗口拖拽区域和排除区域 | 被统一窗口输入 adapter 替代并完成拖拽回归 |
| `constants.js` | active constants | 跨视图共享的稳定 UI 常量 | 所有调用方迁移到明确的领域常量 owner 后删除 |
| `eventBus.js` | active event adapter | 同一 JS 上下文事件与公共 Web 消息订阅（无原生脚本回调） | 公共事件 adapter 替代并完成跨 Tab/C++ 回归 |
| `viewLifetime.js` | active lifecycle helper | 阻止卸载后异步启动、回调及迟到订阅泄漏；允许附加世界 revision 检查 | 所有视图改用等价生命周期 owner 且异步卸载回归通过 |
| `serviceInitialization.js` | active lifecycle helper | 服务初始化响应错误和有限重试策略 | 统一 service lifecycle owner 吸收后删除 |
| `viewportCameraController.js` | active viewport adapter | 创造模式自由相机输入、运动及帧调度；不拥有场景绑定 | 统一相机控制器替代且完成视口输入回归 |
| `viewportUiMode.js` | active viewport adapter | 视口模式、光标设置和本地 UI 状态 | 视口状态 owner 吸收且完成设置迁移 |

## 依赖方向

- active utils 可以被 Vue 视图、视口控制器和对应 service 使用，但不得拥有
  Actor、Scene、项目或服务领域状态；
- active utils 不得直接调用 `window.cefQuery`，也不得重新引入已删除的 bridge；
- `src/api/editorApi.js` 是 manifest transport 和公共 JS contract 的唯一 owner；
  `src/services` 是领域 facade 的 owner；
- raw CEF 不再由 canonical Frontend 启动入口安装；新的跨层调用必须使用
  `src/api/editorApi.js`，不得在 `src/utils` 重新引入旧 CEF wrapper；
- 新功能不得继续放入本目录：需要跨层契约的功能进入 `src/api`，领域编排进入
  `src/services`；旧宿主历史 alias 不再受支持。

## 验证与删除策略

viewportUiMode 的模式/标定 store 使用 applyToNative，经注入的 editorApi.viewport.configure 提交
sceneId/cameraId/archiveSession；applyToBridge 已删除，不转为数字句柄或回退旧通道。
calibration 的 localStorage JSON 仅用于既有持久化，不属于 Web/C++ 通信；活动 storage 协作另待迁移。
pointer controller 同样只组合 editorApi.viewport.configure，传精确 binding；没有 coronaBridge owner。
坐标转换、RAF 合并、待完成时最新未发送状态、失焦/取消/dispose 清理属于交互编排，不拥有独立 transport。

边界由 `editor/Frontend/tests/python/test_frontend_utils_boundary.py` 验证。旧宿主
兼容入口已删除；新增跨层能力必须进入 `src/api` 或明确的领域 service。

选择归属使用原生 selection.source_camera_handle 与 CameraView opaque_handle 的精确
非零十进制字符串比较，拒绝 numeric handle，不以 Number 转换比较。此规则只覆盖已迁移的
Actor 选择和拾取路径。

`viewportCameraController.readAppliedCameraPose` 仅校验 archive/scene/camera 身份与有限姿态并复制领域数组，
供 MainPage/CameraView 同步已经由原生应用的相机状态；不调用 V8、不创建消息通道、不重发相机写入。
跨文档 camera-pose-applied 由 SceneBar 经 appService/公共 Web 消息模块发布，eventBus.emit 仅用于本页面。
