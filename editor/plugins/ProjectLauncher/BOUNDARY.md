# `ProjectLauncher` 插件边界

一个项目就是一个场景目录，唯一档案入口是目录中的 `scene.ini`。
`project.*` native aggregate 是创建、打开、校验、资源导入和最近项目的 canonical owner；
`main.py` 只将 Python service 请求转发到 `CoronaEditorApi.project`。

## 子目录职责

| 路径 | 负责内容 | 不负责 |
|---|---|---|
| `main.py` | 旧宿主 service adapter；将历史项目操作转发到 `CoronaEditorApi.project` | 不直接创建 C++ Scene/Actor，不定义第二套公共契约；不作为 Vue/native 启动入口 |
| `runtime/project_templates.py` | 独立 `.actor` 模板与 Actor 文件创建 | 不维护项目或场景模板 |
| `project.importVisionScene` | 显式将 Vision JSON 导入新目录，写入 `scene.ini`、资产清单与 `Assets/` | 不读取或迁移旧 Corona 档案 |
| `project.openProject` | 打开目录或其中的 `scene.ini`，建立唯一当前场景 | 不维护场景列表或入口场景 |

项目创建、打开和场景初始化的权威状态由 C++/runtime host 管理；Python 只负责请求
转换与编排。不得直接导入 `CoronaCore` 或 `backend`。

## 删除条件

不提供旧 `.scene`、`project.ini` 的读取、复制导入或迁移，不维护场景列表、
入口场景、场景切换或项目模板。不得重新增加 Python 复制或兼容实现。
