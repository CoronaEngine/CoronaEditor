# AITool 插件边界

canonical owner：AITool model transport。不负责 Web 业务策略、场景数据或公共 manifest。

AITool 只连接 DeepSeek。main.py 保留 ai.submitRequest 的注册、初始化、设置和关闭；services/model_service.py 负责有界任务队列、配置快照、流式文本和取消；deepseek_client.py 负责 HTTP/JSON/SSE。configuration/ 负责本地密钥与模型设置，密钥不进入 Web。

运行时只接受 model.start/status/cancel 和 ai.settings.get/set。model.start 接受最终 messages 与模型 options。Python 不读取节点图、教程、任务、助手历史或项目文档，不准备业务提示词，不解析业务 JSON。Web 的 aiService.js 保持页面调用接口，aiWorkflows.js 负责领域编排。

runtime/registry.py 负责生命周期。ready 前保留 initializing；初始化失败进入 degraded。初始化、关闭和迟到 worker 结果必须正确处理，不创建第二套宿主或引擎对象。所有模型请求复用标准库客户端，不恢复 Quasar、provider 注册、工具或媒体工作链。LANChat、Actor、资产、场景同步由原生系统负责。

API key 仍来自 editor/.env，进程环境优先，按 CORONA_DEEPSEEK_API_KEY、DEEPSEEK_API_KEY 读取。设置保存后新请求使用新值，已有请求使用其配置快照。读取与保存只返回 configured 和 masked_key。非密钥 deepseek_settings.json 在启动时读取，节点生成继续支持 node_graph 配置覆盖。模型默认 deepseek-v4-flash，地址保持 DeepSeek 官方 API。

删除条件：Web 业务回归、源目录与部署目录的标准库运行验证、HTTP/JSON/SSE 和取消测试全部通过。禁止在 Python 服务中重新引入业务策略。
