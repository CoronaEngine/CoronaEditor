# Corona Engine Editor
- 此仓库为Corona Engine的编辑器
- 前端Web
	- 基于Node.js（Vue + Tailwind）
	- 实现基于积木可视化编程（类似Scratch），积木运行时转为Python
- 后端/脚本层Python
	- 基于MCP接入大模型
	- 使用PyQt6的QWebEngineView及QDockWidget搭建前端界面布局
- 底层C艹
	- 支持Python层的热重载，保存文件自动更新Python代码逻辑
  
### 环境配置
- 使用CMake并根据本地环境相应预设
	- CMake将自动下载Node.js与Python的相关依赖
- Python层可独立运行
	- 需要在CMake后，使用ExternalEnvironment中Python环境
 	- 程序入口为SourceCode\CabbageEditorBackend\main.py
- Web层可独立运行
	- 需要Node.js环境
 	- 代码位于SourceCode\CabbageEditorFrontend

### 前端Todo
- ESC弹出设置页面
- dock，关闭、缩放、拖拽、停靠事件重构，使用JS控制
	- BUG:dock拖动边框改变窗口大小
 	- BUG:dock浮动偶尔失效
	- dock浮动换为拖拽到边界自带触发
- 补全各种积木，满足贪吃蛇、飞机大战等游戏开发
	- 鼠标、键盘事件，各种基础逻辑，各种引擎调用
	- 撰写积木的文档
- 主页面按键控制逻辑
- BUG：积木的导入 
- BUG：camera的问题
  
### 后端Todo
- dock浮动的时候，指定位置、size的接口
- 读写文件开放接口（非Dialog，读写txt、json等）
- BUG:积木hotfix会导致多次运行
- BUG:c艹运行，关闭报错
- BUG：包菜的dock在主副屏幕的问题
  
### 美术Todo
-  主页场景再设计(3D场景) 
-  场景三轴、XYZ参考坐标、地板网格
-  设计标题（CabbageEngine），引擎LOGO，包材娘（3D）

### 大模型Todo
- 接入三维生成用的模型
- 优化：上下文问题
- 优化：视觉信息
