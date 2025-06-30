# Corona Engine Editor
- 此仓库为Corona引擎的前后端及热更新部分
- 前端为Vue构建，包括前端界面及逻辑部分，内嵌了TailwindCss、Blockly等模块
- 后端为Python构建，主要使用PyQt6的QWebEngineView及QDockWidget搭建前端界面布局，主要包括数据处理及脚本逻辑实现
- 底层为C++构建，主要用于搭建前后端环境及热重载功能。
  
### 配置方式
- cmake

### 前端需求
- dock，关闭、缩放、拖拽、停靠事件重构，使用JS控制
	- BUG:dock拖动边框改变窗口大小
 	- BUG:dock浮动偶尔失效
	- dock浮动换为拖拽到边界自带触发
- 补全各种积木，满足贪吃蛇、飞机大战等游戏开发
	- 鼠标、键盘事件
 	- 各种基础逻辑
  	- 各种引擎调用
        - 补全引擎接口(Python FallBack预留)
- 主页面按键控制逻辑
- BUG：积木的导入 
- BUG：camera的问题
  
### 后端需求
- dock浮动的时候，指定位置的接口
- 读写文件开放接口
- BUG:积木hotfix会导致多次运行
- BUG:关闭报错
  
### 美术需求
-  主页场景再设计(3D场景) 
-  场景三轴、XYZ参考坐标、地板网格
-  设计标题（CabbageEngine），引擎LOGO，包材娘（3D）

### 大模型需求
- 接入三维生成用的模型
- 优化：上下文问题
- 优化：视觉信息
