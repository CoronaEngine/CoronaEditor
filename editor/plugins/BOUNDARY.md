# 编辑器插件边界

Python 宿主注册 `ProjectArchive` 和 `ScratchTool`。前者通过 `runtime/archive` 校验并读取项目、解析只读外部场景，并在显式保存时把引擎内存中的值写入 `scene.ini`。后者在同一解释器中运行 Blockly 生成的文件。脚本运行及停止恢复只操作内存。生命周期由 `runtime/registry.py` 和 `runtime/editor_host.py` 管理。

`ProjectLauncher/templates/actor/demo.actor` 是原生文件管理器使用的模板。场景、文件和项目设置由 C++ manifest 处理。Web 通过 `Frontend/src/api/editorApi.js` 访问这些接口。
