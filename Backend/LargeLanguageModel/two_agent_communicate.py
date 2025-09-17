import json
import uuid
import openai
import string
import asyncio
from pathlib import Path
from typing import List,Dict,Union
from datetime import datetime
from pydantic import BaseModel
from dataclasses import dataclass
from typing_extensions import Annotated
from autogen_core.tools import FunctionTool
from autogen_agentchat.messages import TextMessage
from autogen_agentchat.agents import AssistantAgent
from autogen_core import SingleThreadedAgentRuntime
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_core.models import AssistantMessage, ChatCompletionClient, LLMMessage, SystemMessage, UserMessage
from autogen_core import ToolAgent, Image, AgentId, TopicId, RoutedAgent, FunctionCall, DefaultTopicId, MessageContext, message_handler, TypeSubscription, SingleThreadedAgentRuntime,default_subscription
from autogen_ext.tools.mcp import StdioServerParams, mcp_server_tools

# 忽略 asyncio 中 Proactor 下的关闭管道报错
_original_del_proactor = asyncio.proactor_events._ProactorBasePipeTransport.__del__
_original_del_subprocess = asyncio.base_subprocess.BaseSubprocessTransport.__del__

def safe_del(self):
    try:
        _original_del_proactor(self)
    except Exception:
        pass

def safe_subproc_del(self):
    try:
        _original_del_subprocess(self)
    except Exception:
        pass

asyncio.proactor_events._ProactorBasePipeTransport.__del__ = safe_del
asyncio.base_subprocess.BaseSubprocessTransport.__del__ = safe_subproc_del


model_client = OpenAIChatCompletionClient(
    model="deepseek-ai/DeepSeek-V3",
    api_key="sk-txlrveamjgduydqvpfqbfvgqoqtjkbarnikcoeaeddxzzmjo",
    base_url="https://api.siliconflow.cn/v1",
    model_info= {
        "vision": False,
        "function_calling": True,
        "json_output": True,
        "family": "unknown",
    }
)

@dataclass
class Messages:
    task: str

@default_subscription   #默认订阅default，接收所有default发的信息
class TaskPlanner(RoutedAgent):
    """一个专业的三维任务扩充专家"""

    def __init__(self, model_client: ChatCompletionClient) -> None:
        super().__init__("一个专业的三维任务扩充专家.")
        self._system_messages: List[LLMMessage] = [
            SystemMessage(
                content="""
                    你是一个专业的三维任务扩充专家，擅长将用户提供的简洁自然语言描述扩展为可在 Blender 中准确建模的详细建模指令。
                    你的目标是：
                    1. 完全保留用户输入的原始语义；
                    2. 补全每个物体的具体细节：颜色、大小（用三维尺寸表示）、位置（用三维坐标表示）；
                    3. 明确物体间的空间关系，使用 Blender 中可以识别的绝对或相对坐标；
                    4. 所有内容必须是 Blender 中可以直接实现的；
                    5. 不得出现抽象、虚幻、不具象的描述（如“梦幻般的光”）；
                    6. 对于未提及的细节，如尺寸或颜色，可基于常识进行合理补全；
                    7. 输出必须为自然语言一段话，但每个物体的描述应清晰、独立；
                    8. 描述应尽可能简洁明了，便于程序解析或人类阅读；
                    请输出一段包含所有建模信息的自然语言字符串。
                    例如：
                    输入：
                    一个放在桌子上的咖啡杯
                    输出：
                    请在 Blender 中创建一个咖啡杯，颜色为蓝色，尺寸为 0.5 米 x 0.5 米 x 0.5 米，放置在尺寸为1.2m×0.7m×0.75m（长×宽×高）的矩形桌子，材质为深棕色木质纹理桌子上。
            """,# +BaseKonwledge
            )
        ]
        self._model_client = model_client
       
    @message_handler
    async def handle_code_plan_task(self, message: Messages, ctx: MessageContext) -> None:
        # Generate a response using the chat completion API.
        response = await self._model_client.create(
            self._system_messages + [UserMessage(content=message.task, source=self.metadata["type"])],
            cancellation_token=ctx.cancellation_token,
        )
        print(response)
        publish_messages = Messages(task=response.content)
        await self.publish_message(publish_messages, topic_id="default")

@default_subscription   #默认订阅default，接收所有default发的信息
class BlenderAgent(RoutedAgent):
    """You are a helpful assistant. You can use various tools via MCP."""

    def __init__(self, model_client: ChatCompletionClient, tools) -> None:
        super().__init__("You can use various tools via MCP.")
        self._system_messages: List[LLMMessage] = [
            SystemMessage(
                content="""
                    You are a helpful assistant. You can use various tools via MCP.
                 """,# +BaseKonwledge
            )]
        self._model_client = model_client
        self._tools = tools
        self._reflect_on_tool_use = True
        self._model_client_stream = True
       
    @message_handler
    async def handle_code_plan_task(self, message: Messages, ctx: MessageContext) -> None:
        # Generate a response using the chat completion API.
        response = await self._model_client.create(
            self._system_messages + [UserMessage(content=message.task, source=self.metadata["type"])],
            tools=self._tools,
            cancellation_token=ctx.cancellation_token,
        )
        print(response)



async def main() -> None:
    runtime = SingleThreadedAgentRuntime()

    desktop = str(Path.home())
    server_params = StdioServerParams(
        command="cmd", args=["/c", "uvx", "blender-mcp", desktop]
    )
    # 需要安装 uv 工具：https://github.com/astral-sh/uv
    # 封装从MCP Server得到的Tools
    tools = await mcp_server_tools(server_params)
    print("tools: ",tools)
    # await TaskPlanner.register(runtime, "TaskPlanner", lambda: TaskPlanner(model_client=model_client))
    await BlenderAgent.register(runtime, "BlenderAgent", lambda: BlenderAgent(model_client=model_client, tools=tools))
    
    runtime.start()
    await runtime.publish_message(
        message=Messages(task="帮我在blender中创建一个猴头"),
        topic_id=DefaultTopicId(),
    )

    # Keep processing messages until idle.
    await runtime.stop_when_idle()

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(main())
        # 等待后台任务关闭（如 transport 等）
        loop.run_until_complete(asyncio.sleep(0.1))
    finally:
        loop.run_until_complete(loop.shutdown_asyncgens())
        loop.close()
