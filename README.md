# Corona Engine Editor
- 此仓库为Corona Engine的编辑器
- 前端Web：
	- 基于Node.js（Vue + Tailwind）
	- 实现基于积木可视化编程（类似Scratch），积木运行时转为Python
- 后端/脚本层Python：
	- 基于MCP接入大模型
	- 使用PyQt6的QWebEngineView及QDockWidget搭建前端界面布局
- 底层C艹：
	- 支持Python层的热重载，保存文件自动更新Python代码逻辑
  
### 环境配置
- 运行build.py将自动下载Node.js与Python的相关依赖
- Python层可独立运行
 	- 程序入口为SourceCode\CabbageEditorBackend\main.py
- Web层可独立运行
 	- 代码位于SourceCode\CabbageEditorFrontend
