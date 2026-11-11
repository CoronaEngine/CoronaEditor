# Frontend `src` 目录边界

> 2026-11-06：Web 间由 api/webMessages.js 统一传递 structured clone 数据；
> Web/C++ 统一 V8 入口。manifest adapter 的结果包装不等于另一条传输通道。
> 目标职责和完成条件见 [通信迁移说明](../COMMUNICATION.md)。

`editor/Frontend/src` 是 Vue 编辑器的宿主层。目录之间按“公共契约 → 领域 service →
页面和路由视图/组件”和“低延迟输入 adapter”分工；Vue 层不持有 C++ Scene/Actor
权威状态，不执行 Python AI 或角色脚本。

## 顶层目录职责

| 目录 | 类型 | 唯一职责 | 删除/迁移条件 |
|---|---|---|---|
| `api/` | active contract adapter | 引用原生 typed V8 方法、提供公共聚合接口；未迁移方法仍保留 manifest adapter；见 [`api/BOUNDARY.md`](api/BOUNDARY.md) | 不删除公共契约；单个方法迁移需有 caller 和回归证据 |
| `assets/` | static assets | 前端静态图片、样式和运行时资源 | 所有引用迁移且构建产物回归通过 |
| `blockly/` | active editor/compiler | Blockly/Scratch、节点图 UI、受限 Script Runtime 代码生成 | 见 [`blockly/BOUNDARY.md`](blockly/BOUNDARY.md) |
| `components/` | active UI | 可复用 Dock、面板和通用 UI 组件；不反向依赖路由级页面 | 调用方迁移到新 UI 且完成视觉/交互回归 |
| `composables/` | active UI state | 跨组件可复用的 Vue composition 行为 | 对应状态/行为由明确 owner 吸收后删除 |
| `config/` | active configuration | 插件面板元数据、应用和静态前端配置；不得静态导入 Vue 组件 | 配置 owner 合并且构建/启动回归通过 |
| `i18n/` | active presentation | 翻译、语言同步和 DOM 文案适配 | 统一 catalog 完整吸收并通过 i18n 检查 |
| `router/` | active navigation | 路由、页面入口和 standalone Dock 参数 | 路由系统替代且深链/独立窗口回归通过 |
| `services/` | active facade/orchestration | 领域 service、节点图和 Cabbage UI 编排；不拥有公共 transport；见 [`services/BOUNDARY.md`](services/BOUNDARY.md) | 见 [`services/BOUNDARY.md`](services/BOUNDARY.md) |
| `stores/` | active UI state | Dock、应用级 UI 状态和跨组件展示状态 | 统一状态 owner 替代且多窗口回归通过 |
| `utils/` | active adapter | 低延迟输入和视口辅助；见 [`utils/BOUNDARY.md`](utils/BOUNDARY.md) | 见 [`utils/BOUNDARY.md`](utils/BOUNDARY.md) |
| `views/` | active page composition | 路由级页面、侧栏、工具视图和 `panelRegistry.js` 页面组件注册；组合 API/service/component | 页面拆分或新宿主替代并完成完整交互回归 |

## 依赖方向与兼容入口

- `api/editorApi.js` 是公共 JS contract adapter；已迁移方法直接引用同一原生 V8 对象，manifest 方法同样走 V8、保留 manifest 契约及结果包装；Web 消息唯一实现为 api/webMessages.js；
- `config/pluginManifest.js` 只提供面板元数据；`views/panelRegistry.js` 负责将
  manifest ID 映射到 Vue 组件，配置层不得反向依赖 `views/` 或具体 `.vue` 文件；
- `services/` 组合 `api/`，`views/` 组合 `api/`、`services/`、`components/` 和已登记
  的 `utils/` adapter；`components/` 不应反向依赖路由级 `views/`；
- 外部旧宿主 bridge 已删除；transport 和 service 实现分别归 `api/` 与 `services/`，
  不得在 Vue 业务中复制旧协议；
- 拾取、Gizmo、视口和输入 adapter 只组合现有 V8 能力，不恢复 window.coronaBridge；不得传递 `Camera`、`Actor` 或 `Geometry` 对象；
- `api/webDocument.js` 缓存不可变的文档启动身份，App、路由、窗口会话、AI 和消息模块共享；路由变化不能改变主/子角色。子文档必须继承启动 owner；
- `utils/viewLifetime.js` 提供异步初始化、订阅及迟到响应的清理保护；App 项目/LAN 订阅也复用该保护，保留项目 refresh/preparation revision；语言协作经公共 Web 消息传递，localStorage 只持久化偏好；
- 新的场景、项目、Actor、AI 或脚本语义必须登记到对应 typed 原生契约或 Web service owner，不能
  直接写入页面、组件、store 或通用 utils。

## 删除条件与验证

目录边界由 `editor/Frontend/tests/python/test_frontend_source_tree_boundary.py` 和
各子目录边界测试共同验证。外部旧宿主兼容不在当前支持范围内。


相机姿态/基本配置统一走带 archive_session 和精确 camera_id 的 V8 setCameraProperties，不再使用 Fast 移动通道。
