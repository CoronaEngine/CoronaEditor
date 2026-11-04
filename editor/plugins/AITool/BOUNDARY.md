# `AITool` 插件边界

`AITool` 为当前前端提供 Cabbage 对话、任务和 NodeGraph 检查/生成。它是业务编排层，不是 C++
引擎对象、Vue transport、Python host lifecycle 或公共 manifest 的 owner。

## 子目录职责

| 路径 | canonical owner | 负责内容 | 不负责 |
|---|---|---|---|
| `configuration/` | AITool configuration owner | `.env`、API key 和本地配置读取 | 不保存密钥到源码、日志或 Vue bundle |
| `deepseek_client.py` | DeepSeek HTTP 客户端 | 构造 HTTP 请求、读取 JSON 响应和 SSE 文本 | 业务提示词、任务状态和取消策略由调用服务负责 |
| `services/` | AITool service owner | 节点检查、聊天、生成和 Cabbage 上下文四个服务 | 不直接操作 `Actor`/`Scene`，不定义公共 manifest |
| `compat/`、`utils/` | removed compatibility code | 目录和旧导入入口已删除；配置统一由 `configuration/` 负责 | 不得重新创建旧入口 |

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
- 初始化先加载本地密钥与模型设置，再加载四个服务。初始化期间关闭或失败必须释放已创建
  的服务，不得发布迟到的结果；重复关闭不重复释放服务。
- `ai.submitRequest` 是唯一 AI manifest 方法。支持节点检查、聊天和生成的异步操作、
  Cabbage 上下文/任务/评分操作及 `ai.settings.get/set`；不再接受旧通用聊天请求。
- LANChat 房间、Actor、资产和场景同步由现有原生网络系统维护，不依赖 AI worker。

## 删除条件

Agent Runtime、Agent Collaboration、LANChat AI 编排及旧聊天/媒体链已经退役，其专属
测试随功能移除。Actor 物理契约与原生同步测试必须保留；禁止恢复旧工具注册入口。
Quasar 子模块、配置桥接和专属依赖已移除。四个服务通过共享客户端使用标准库调用 DeepSeek 官方 API。
项目上下文、用户密钥和媒体数据不属于源码清理范围。

## DeepSeek 配置

`configuration/deepseek_settings.py` 是模型配置 owner。未提供覆盖时，模型保持
`deepseek-v4-flash`；审查/评分使用 0.1/1200，聊天使用 0.25/1400，目标规划使用
0.25/3600，节点生成使用 0.05/12000（temperature/max_tokens）。默认关闭 thinking。
四个服务保留各自的提示词、超时、请求参数、错误处理和业务校验。

可选的 `editor/deepseek_settings.json` 仅存放非密钥参数，启动时读取一次。例如迁移原
provider.model 和 node_graph 设置时，使用：

```json
{
  "model": "deepseek-v4-flash",
  "node_graph": {
    "model": "deepseek-v4-flash",
    "temperature": 0.05,
    "max_tokens": 12000,
    "thinking": false
  }
}
```

节点生成模型优先于全局模型；空值回退、数字转换和 thinking 仅接受布尔 true 的语义保持
不变。只连接 DeepSeek 官方地址，不提供 provider 注册或第三方 base_url 覆盖。
旧 CORONA_LLM_MODEL/PROVIDER 环境变量原本不控制这些服务，现在也不读取。

密钥仍来自 `editor/.env`，进程环境优先，依次读取 `CORONA_DEEPSEEK_API_KEY` 和
`DEEPSEEK_API_KEY`。设置页保存时更新两个别名及当前密钥，新请求立即使用新值；已有请求
保留其配置快照，模型参数不会随密钥刷新。读取/保存接口只返回 configured 和 masked_key。
不监听外部文件编辑；修改模型配置后需重新启动编辑器。文件不应包含 api_key。
