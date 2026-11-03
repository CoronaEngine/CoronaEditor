# `AITool` 插件边界

`AITool` 为当前前端提供 Cabbage 对话、任务和 NodeGraph 检查/生成。它是业务编排层，不是 C++
引擎对象、Vue transport、Python host lifecycle 或公共 manifest 的 owner。

## 子目录职责

| 路径 | canonical owner | 负责内容 | 不负责 |
|---|---|---|---|
| `configuration/` | AITool configuration owner | `.env`、API key 和本地配置读取 | 不保存密钥到源码、日志或 Vue bundle |
| `services/` | AITool service owner | 节点检查、聊天、生成和 Cabbage 上下文四个服务 | 不直接操作 `Actor`/`Scene`，不定义公共 manifest |
| `cai_extensions/` | AITool configuration bridge | 向 Quasar 注入编辑器路径与应用配置 | 不注册 Agent、MCP 工具、工作流或网络 worker |
| `compat/`、`utils/` | removed compatibility code | 目录和旧导入入口已删除；配置统一由 `configuration/` 负责 | 不得重新创建旧入口 |
| `Quasar/` | 外部子模块 | 上游 AI runtime 内容 | 本仓迁移不修改 |

## 依赖与生命周期

- `runtime/registry.py` 负责注册、后台初始化和关闭；插件不得自行创建第二套 host
  lifecycle。
- 引擎场景只能通过 `api.editor_api`
  访问；不得直接导入 `CoronaCore`、native `Actor`、`Scene` 或底层 binding。
- 当前场景统一通过 native `scene.get_snapshot` 获取；不提供场景列表或场景切换。
- 项目上下文由 `runtime.project_context` 提供；不以进程 cwd 作为活动项目。
- API key 只能由 `configuration/` 从 `.env` 或受控本地配置读取，日志不得输出秘钥。
- 基础 API 在 runtime ready 前必须保留 `initializing` 语义；初始化失败进入
  `degraded`，不得无界重试。
- 初始化先安装配置桥接，再加载设置和四个服务。初始化期间关闭或失败必须释放已创建
  的服务，不得发布迟到的结果；重复关闭不重复释放服务。
- `ai.submitRequest` 是唯一 AI manifest 方法。支持节点检查、聊天和生成的异步操作、
  Cabbage 上下文/任务/评分操作及 `ai.settings.get/set`；不再接受旧通用聊天请求。
- LANChat 房间、Actor、资产和场景同步由现有原生网络系统维护，不依赖 AI worker。

## 删除条件

Agent Runtime、Agent Collaboration、LANChat AI 编排及旧聊天/媒体链已经退役，其专属
测试随功能移除。Actor 物理契约与原生同步测试必须保留；禁止恢复旧工具注册入口。
Quasar 仍提供模型配置收集，配置桥接与密钥刷新验证完成前不能移除子模块及其依赖。
项目上下文、用户密钥和媒体数据不属于源码清理范围。
