# Script Runtime 边界

`script_runtime` 提供 Blockly/Scratch 生成文件的受限角色脚本运行时。一个文件绑定一个项目或 Actor 目标。Web 保存 workspace 和生成的 Python 文件，向 `scripts.runFile` 提交项目相对路径、SHA-256 和 `requestId`。C++ 校验路径，将消息交给当前编辑器的 Python 宿主。存档解析与脚本共用解释器、环境和模块表。

| 路径 | 职责 |
|---|---|
| `blockly/main.py` | 在活动项目的 `Scripts/blockly` 保存 workspace、文件和 manifest；核对摘要、创建运行上下文、注册回执、调用文件中的 `run()`。 |
| `engine/` | 为生成代码提供变量、输入、广播、克隆、引擎操作与场景恢复。 |
| `manifest_adapter.py` | 受限 manifest adapter，使用 ScriptRuntime caller 读取场景、更新 Actor 和视口。 |
| `native_engine_adapter.py` | 脚本音频、鼠标和射线查询等原生能力。 |

脚本不得绕过受限接口获取编辑器公共 API 的原生对象。结束执行时需先停止输入与子任务，再恢复同一项目的快照。恢复失败保留快照以供重试。相同启动请求使用相同的 `requestId` 查询或重试；停止指定运行时使用 `runId`。项目切换先完成旧场景恢复。

旧项目中的手写脚本不会自动加载；已退役的外部 Python 文件积木在生成阶段报告错误。编辑器保留单图运行和项目存档，不提供批量预览。
