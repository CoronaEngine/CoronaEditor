import json
import asyncio # Import asyncio to run the async main function
from dataclasses import dataclass
from typing import List
from pathlib import Path
from autogen_core import (
    FunctionCall,
    MessageContext,
    RoutedAgent,
    message_handler,
)
from autogen_core.model_context import ChatCompletionContext
from autogen_agentchat.messages import TextMessage
from autogen_agentchat.agents import AssistantAgent

from autogen_core.models import (
    AssistantMessage,
    ChatCompletionClient,
    FunctionExecutionResult,
    FunctionExecutionResultMessage,
    LLMMessage,
    SystemMessage,
    UserMessage,
)
from autogen_core.tools import ToolResult, Workbench

from autogen_core import AgentId, SingleThreadedAgentRuntime
from autogen_core.model_context import BufferedChatCompletionContext
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.tools.mcp import McpWorkbench
from autogen_ext.tools.mcp import StdioServerParams, mcp_server_tools

import warnings
warnings.filterwarnings("ignore", category=ResourceWarning, message="unclosed transport")

@dataclass
class Message:
    content: str


class WorkbenchAgent(RoutedAgent):
    def __init__(
        self, model_client: ChatCompletionClient, model_context: ChatCompletionContext, workbench: Workbench
    ) -> None:
        super().__init__("An agent with a workbench")
        self._system_messages: List[LLMMessage] = [SystemMessage(content="You are a helpful AI assistant.")]
        self._model_client = model_client
        self._model_context = model_context
        self._workbench = workbench

    @message_handler
    async def handle_user_message(self, message: Message, ctx: MessageContext) -> Message:
        # Add the user message to the model context.
        await self._model_context.add_message(UserMessage(content=message.content, source="user"))
        print("---------User Message-----------")
        print(message.content)

        # Run the chat completion with the tools.
        create_result = await self._model_client.create(
            messages=self._system_messages + (await self._model_context.get_messages()),
            tools=(await self._workbench.list_tools()),
            cancellation_token=ctx.cancellation_token,
        )

        # Run tool call loop.
        while isinstance(create_result.content, list) and all(
            isinstance(call, FunctionCall) for call in create_result.content
        ):
            print("---------Function Calls-----------")
            for call in create_result.content:
                print(call)

            # Add the function calls to the model context.
            await self._model_context.add_message(AssistantMessage(content=create_result.content, source="assistant"))

            # Call the tools using the workbench.
            print("---------Function Call Results-----------")
            results: List[ToolResult] = []
            for call in create_result.content:
                result = await self._workbench.call_tool(
                    call.name, arguments=json.loads(call.arguments), cancellation_token=ctx.cancellation_token
                )
                results.append(result)
                print(result)

            # Add the function execution results to the model context.
            await self._model_context.add_message(
                FunctionExecutionResultMessage(
                    content=[
                        FunctionExecutionResult(
                            call_id=call.id,
                            content=result.to_text(),
                            is_error=result.is_error,
                            name=result.name,
                        )
                        for call, result in zip(create_result.content, results, strict=False)
                    ]
                )
            )

            # Run the chat completion again to reflect on the history and function execution results.
            create_result = await self._model_client.create(
                messages=self._system_messages + (await self._model_context.get_messages()),
                tools=(await self._workbench.list_tools()),
                cancellation_token=ctx.cancellation_token,
            )

        # Now we have a single message as the result.
        assert isinstance(create_result.content, str)

        print("---------Final Response-----------")
        print(create_result.content)

        # Add the assistant message to the model context.
        await self._model_context.add_message(AssistantMessage(content=create_result.content, source="assistant"))

        # Return the result as a message.
        return Message(content=create_result.content)


class AiAgent(RoutedAgent):
    """An agent that answer the question from user."""

    def __init__(self, model_client: ChatCompletionClient, name:str) -> None:
        super().__init__("A AI agent.")
        self._delegate = AssistantAgent(name, model_client=model_client)

    @message_handler
    async def handle_code_writing_task(self, message: Message, ctx: MessageContext) -> None:
        # print(f"{self.id.type} received message: {message.content}")
        response = await self._delegate.on_messages(
            [TextMessage(content=message.content, source="user")], ctx.cancellation_token
        )
        print(f"{response.chat_message.content}")


# Define an asynchronous main function to encapsulate the async operations
async def main_wrapper_async():
    global runtime
    # 初始化模型客户端等
    model_client = OpenAIChatCompletionClient(
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        api_key="sk-4299e9946c664f45b2be44b350148dfa",
        model_info={
            "vision": False,
            "function_calling": True,
            "family": "unknown",
            "json_output": True,
        }
    )

    runtime = SingleThreadedAgentRuntime()
    await AiAgent.register(
        runtime,
        "AiAgent",
        lambda: AiAgent(model_client=model_client, name="Aiagent"),
    )

    content = "帮我在blender中建个猴头"

    # 使用真实 subprocess 命令，避免假 command
    blender_server_command = StdioServerParams(
        mode="stdio",  # 该模式默认创建 subprocess 并通过 stdio 通信
        command="blender-mcp",
        args=["--host", "127.0.0.1", "--port", "9876"]
    )

    runtime.start()

    async with McpWorkbench(blender_server_command) as workbench:
        await WorkbenchAgent.register(
            runtime=runtime,
            type="BlenderAgent",
            factory=lambda: WorkbenchAgent(
                model_client=model_client,
                model_context=BufferedChatCompletionContext(buffer_size=10),
                workbench=workbench,
            ),
        )
        await runtime.send_message(
            Message(content=content),
            recipient=AgentId("BlenderAgent", "default"),
        )

    # MCP退出后，立刻关闭runtime，确保资源全部释放
    await runtime.stop()


def main_wrapper():
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(main_wrapper_async())
    except Exception as e:
        print(f"运行出错：{e}")
    finally:
        try:
            # 先强制取消所有挂起任务，避免 loop.close 后有 transport 抛错
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        except Exception as cleanup_err:
            print(f"事件循环清理出错：{cleanup_err}")
        loop.close()


runtime = None  # 全局变量
# Run the main asynchronous function
if __name__ == "__main__":
    # #启动异步程序，它内部已经自动管理事件循环关闭。
    # 当事件循环（event loop）关闭时，Transport 对象还没完全关闭或释放。
    # 在 Transport.__del__（析构函数）执行时，它尝试调度异步事件，但此时事件循环已经关闭，导致了 RuntimeError: Event loop is closed。
    # Transport 是 asyncio 底层用来管理“数据传输通道”的抽象接口，就是负责异步 I/O 操作的“管道”或“连接”。
    # asyncio.run(main()) 
    main_wrapper()
