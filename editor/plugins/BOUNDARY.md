# 编辑器插件边界

Python 宿主注册 `ProjectArchive` 和 `ScratchTool`。前者通过 `runtime/archive` 解析项目和外部场景，后者在同一解释器中运行 Blockly 生成的文件。生命周期由 `runtime/registry.py` 和 `runtime/editor_host.py` 管理。

`ProjectLauncher/templates/actor/demo.actor` 是原生文件管理器使用的模板。场景、文件和项目设置由 C++ manifest 处理。Web 通过 `Frontend/src/api/editorApi.js` 访问这些接口。
