# `editor/plugins` 边界

`editor/plugins` 只承载按 Python service 注册的编辑器业务插件。插件可以组合
`editor/api`、`editor/runtime` 和对应的 host support，但不能成为 C++ manifest、
Vue transport、引擎对象或角色脚本运行时的第二个 owner。

## 插件职责

| 目录 | 类型 | canonical 职责 | 删除/迁移条件 |
|---|---|---|---|
| `FileManager/` | native aggregate + service facade | `files.*` 负责文件事实和操作；`main.py` 仅转发公共 contract，旧 Scene/Actor 文件绑定 adapter 已删除 | 外部旧宿主应迁移到 `files.*`，不得重新引入文件插件兼容层 |
| `MainView/` | native lifecycle + service adapter | native `main.*` 负责项目/场景生命周期；`main.py` 只做 service 编排，不持有 Python Scene 生命周期 | 保持 adapter 与 manifest 一致 |
| `ProjectArchive/` | scene.ini loading facade | `main.py` 负责加载策略和诊断，parser 归 `runtime/archive` | 保留按需加载服务，无旧格式迁移 |
| `ProjectLauncher/` | native project flow + service adapter | native `project.*` 负责单场景项目生命周期与 Vision JSON 显式导入；`main.py` 只做 service 编排 | 保持 adapter 与 manifest 一致 |
| `ProjectSettings/` | native aggregate + service adapter | native `projectSettings.*` 负责设置事实；`main.py` 只做 service 编排 | 保持 adapter 与 manifest 一致 |
| `SceneTools/` | native aggregate + service adapter | Vue/C++/Script Runtime 使用 native manifest 聚合接口；Python 只做参数转换和 Vision 编排 | 保持 adapter 与 manifest 一致 |
| `SceneTools/compat/legacy_vision_import_helper.py` 与旧 Vision adapters | removed compatibility code | 无仓内生产调用；受支持流程由 canonical `SceneTools/vision_import.py` 和 native Vision manifest 负责 | 如发现外部依赖，按 aggregate contract 迁移 |

## 依赖方向

- `runtime/registry.py` 是唯一插件注册、初始化和关闭 owner；插件不得自行注册第二套
  host lifecycle；
- 插件通过 `api.editor_api`/manifest 聚合接口访问编辑器语义，不得直接暴露
  `camera()`、`geometry()`、`Actor`、`Scene` 等底层对象给 Vue 或普通 Python；

- `SceneTools`、`MainView` 和 `ProjectArchive` 不得重新引入 Python Scene 事实或
  compatibility 实现；场景操作必须走 manifest；
- AI 配置与密钥刷新只由本地 `configuration/` 管理，不加载外部 Agent 或模型框架；
- 新增插件功能必须先确定公共 manifest/service owner、生命周期、测试 owner 和删除条件。

## 删除条件与验证

边界由各插件本地测试、`editor/runtime/tests` 和本目录边界测试共同验证。删除或移动
插件目录前必须确认 runtime registry、Vue/外部宿主调用方、配置/文件持久化和回退路径；
仅凭仓内搜索不到调用方不能直接删除。

AITool 已退役，AI 的配置、模型请求及业务流程均归 Frontend/src/services；Python 插件不注册 AI 页面或接口。Quasar 不得恢复。
