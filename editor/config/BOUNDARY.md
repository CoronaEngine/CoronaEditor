# `editor/config` 边界

`editor/config` 是编辑器 Python 的配置与路径 owner。它提供路径 owner、活动项目状态和应用运行时配置，
只提供配置值、路径模型和
活动项目状态，不负责插件注册、Scene/Actor 事实、AI secret 或 C++ transport。

## 文件职责

| 文件 | canonical 职责 | 当前状态 | 删除/合并条件 |
|---|---|---|---|
| `paths_config.py` | 路径 owner：仓库、Frontend、生成脚本、项目 media/models/screenshots，以及旧项目复制 data 目录等路径模型和动态目录解析 | active | 统一路径模型完整吸收并通过启动/项目切换回归 |
| `project_state.py` | 活动项目状态、用户数据目录中的 `CoronaEditor.ini`、最近项目、项目配置读写和版本信息 | active canonical owner | 由 native project/projectSettings 完整吸收后再评估 |
| `app_config.py` | 应用级 `AppConfig` 单例、配置文件和 `CORONA_*` 环境覆盖 | active | 应用 host 配置 owner 完整替代并通过启动/环境变量回归 |
| `runtime_config.py` | 不可变运行时配置值对象和默认值 | active support | 被统一 app config schema 吸收后删除 |

## 依赖方向

- `paths_config.py` 负责“路径是什么”，`settings.py` 负责“当前项目和项目配置是什么”，
  不应把两者重新合并成无边界的全局工具；
- 嵌入式运行时通过私有 `CoronaEngine._get_runtime_paths()` 读取 C++ 启动时解析的路径快照，
  Python 不再次解析 `CoronaEngine.json`。该 binding 只提供启动元数据，不提供业务 API；
- `CoronaEditor.ini` 的运行状态文件位于 `storage.user_data_dir`；`editor/CoronaEditor.ini`
  仅作为初始化模板。独立 Python 工具使用 editor 父目录作为默认用户数据目录，不依赖 `cwd`；
- `PathsConfig.generated_script_dir` 是新生成脚本的 canonical 路径字段；
  指向用户数据目录下的 `runtime/generated`；无活动项目时 media/models 等写入 `scratch`；
- 项目复制的 runtime data 目录由 C++ `project.*` handler 统一解析和管理；配置模块
  不再提供 Python legacy data 目录 helper；
- `resolve_repository_asset_path()` 按 `resources.asset_roots` 顺序查找只读资源；
  `get_repository_assets_dir()` 保留返回首个根目录的兼容接口，运行时生成物不得写回资源目录；
- `app_config.py` 组合 `RuntimeConfig` 和 `PathsConfig`，不拥有活动项目持久化状态；
- 插件、runtime host 和 Script Runtime 可以读取 canonical config owner；
- `paths_config._get_active_project_path()` 可以通过 `api.editor_api` 获取公共活动项目
  契约；除启动路径快照外，配置模块不直接访问 C++ Scene/Actor 或 native binding；
- AITool API key 不属于本目录，必须由 `plugins/AITool/configuration` 从 `.env`/受控本地
  配置加载；
- 路径实例只能从 `config.paths_config.get_default_paths()` 获取。

## 删除条件与验证

边界由 `editor/config/tests`、runtime host、ProjectLauncher、MainView 和项目设置回归
共同验证，覆盖首次启动、已有 `CoronaEditor.ini`、项目切换、路径创建、环境变量覆盖
和 Script Runtime。
