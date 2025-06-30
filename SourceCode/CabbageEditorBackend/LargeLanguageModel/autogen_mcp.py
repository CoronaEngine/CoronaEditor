import asyncio

from pathlib import Path

from autogen_core.models import ModelFamily

from autogen_agentchat.ui import Console
from autogen_agentchat.agents import AssistantAgent

from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.tools.mcp import StdioServerParams, mcp_server_tools

# 模型配置
model_client = OpenAIChatCompletionClient(
    model="deepseek-ai/DeepSeek-V3",
    api_key="sk-txlrveamjgduydqvpfqbfvgqoqtjkbarnikcoeaeddxzzmjo",
    base_url="https://api.siliconflow.cn/v1",
    model_info={
        "vision": False,
        "function_calling": True,
        "json_output": False,
        "family": ModelFamily.UNKNOWN,
        "structured_output": True,
    },
)


async def main() -> None:
    # 有问题，需要修复！
    desktop = str(Path.home())
    server_params = StdioServerParams(
        command="cmd", args=["/c", "uvx", "blender-mcp", desktop]
    )
    # 需要安装 uv 工具：https://github.com/astral-sh/uv

    # 封装从MCP Server得到的Tools
    tools = await mcp_server_tools(server_params)

    # 创建智能体，导入MCP工具
    agent = AssistantAgent(
        name="blender_agent",
        model_client=model_client,
        tools=tools,
        system_message="You are a helpful assistant. You can use various tools via MCP.",
        reflect_on_tool_use=True,
        model_client_stream=True,  # Enable streaming tokens from the model client.
    )

    # 向智能体发出指令
    await Console(agent.run_stream(task="在blender中创建一个猴头"))
    await model_client.close()


if __name__ == "__main__":
    asyncio.run(main())
