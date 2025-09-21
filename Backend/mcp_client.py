import asyncio, json, anyio

from typing import Optional # type: ignore
from contextlib import AsyncExitStack, asynccontextmanager # type: ignore

from openai import OpenAI

from mcp import ClientSession
from mcp.server.fastmcp import FastMCP

# try
#     from transform_server import app as server_app
# except ImportError:
#     from LargeLanguageModel.web_search import app as server_app
@asynccontextmanager
async def create_internal_mcp_connection(app: FastMCP):
    """
    在单个进程内部创建一个 MCP 客户端-服务器连接。
    它使用内存流进行通信，并将 FastMCP 服务器作为一个后台异步任务运行。
    """
    # 1. 创建两对内存流，用于双向通信
    client_to_server_writer, client_to_server_reader = anyio.create_memory_object_stream(0)
    server_to_client_writer, server_to_client_reader = anyio.create_memory_object_stream(0)

    # 2. 定义服务器任务
    async def run_server_task():
        # 将服务器端的读写流连接到我们创建的内存流上
        server_read_stream = client_to_server_reader
        server_write_stream = server_to_client_writer
        
        # 直接调用 FastMCP 实例内部的核心 run 方法，并传入我们的内存流。
        # 这就完全绕过了所有与 stdio 和多进程相关的问题。
        print("--- Internal MCP Server task started. ---")
        await app._mcp_server.run(
            server_read_stream,
            server_write_stream,
            app._mcp_server.create_initialization_options(),
        )
        print("--- Internal MCP Server task finished. ---")

    # 3. 在一个任务组中并发地运行客户端和服务器
    async with anyio.create_task_group() as tg:
        # 在后台启动服务器任务
        tg.start_soon(run_server_task)
        
        # 将客户端的读写流 yield 出去，给主程序使用
        client_read_stream = server_to_client_reader
        client_write_stream = client_to_server_writer
        
        try:
            yield client_read_stream, client_write_stream
        finally:
            # 当客户端代码块结束时，自动取消后台的服务器任务，实现优雅退出
            print("--- Client session ending, cancelling server task... ---")
            tg.cancel_scope.cancel()


class MCPClient:
    def __init__(self):
        self.session: Optional[ClientSession] = None
        self.exit_stack = AsyncExitStack()
        self.client = OpenAI(
            api_key="sk-txlrveamjgduydqvpfqbfvgqoqtjkbarnikcoeaeddxzzmjo",
            base_url="https://api.siliconflow.cn/v1",
        )

    async def connect_to_server(self, app: FastMCP): # 参数现在是 FastMCP 的 app 对象
        print("--- Creating internal MCP connection... ---")
        
        transport = await self.exit_stack.enter_async_context(
            create_internal_mcp_connection(app) # 调用新的连接管理器
        )
        read_stream, write_stream = transport

        self.session = await self.exit_stack.enter_async_context(
            ClientSession(read_stream, write_stream)
        )

        print("--- Client session created, initializing... ---")
        await self.session.initialize()
        print("--- MCP connection initialized successfully! ---")


    async def process_query(self, query: str) -> str:
        # 这里需要通过 system prompt 来约束一下大语言模型，
        # 否则会出现不调用工具，自己乱回答的情况
        system_prompt = (
            "You are a helpful assistant."
            "You have the function of online search. "
            "Please MUST call web_search tool to search the Internet content before answering."
            "Please do not lose the user's question information when searching,"
            "and try to maintain the completeness of the question content as much as possible."
            "When there is a date related question in the user's question,"
            "please use the search function directly to search and PROHIBIT inserting specific time."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query},
        ]

        # 获取所有 mcp 服务器 工具列表信息
        response = await self.session.list_tools()
        # 生成 function call 的描述信息
        available_tools = [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "input_schema": tool.inputSchema,
                },
            }
            for tool in response.tools
        ]

        # 请求 llm，function call 的描述信息通过 tools 参数传入
        response = self.client.chat.completions.create(
            model="Qwen/Qwen3-14B", messages=messages, tools=available_tools
        )

        # 处理返回的内容
        content = response.choices[0]
        if content.finish_reason == "tool_calls":
            # 如何是需要使用工具，就解析工具
            tool_call = content.message.tool_calls[0]
            tool_name = tool_call.function.name
            tool_args = json.loads(tool_call.function.arguments)

            # 执行工具
            result = await self.session.call_tool(tool_name, tool_args)
            print(f"\n\n[Calling tool {tool_name} with args {tool_args}]\n\n")

            # 将 deepseek 返回的调用哪个工具数据和工具执行完成后的数据都存入messages中
            messages.append(content.message.model_dump())
            messages.append(
                {
                    "role": "tool",
                    "content": result.content[0].text,
                    "tool_call_id": tool_call.id,
                }
            )

            # 将上面的结果再返回给 deepseek 用于生产最终的结果
            response = self.client.chat.completions.create(
                model="Qwen/Qwen2.5-7B-Instruct",
                messages=messages,
            )
            return response.choices[0].message.content

        return content.message.content

    async def chat_loop(self):
        """
        启动一个简洁的交互式聊天循环。
        按 Ctrl+C 退出。
        """
        # 在循环开始前，提示一次退出方法
        print("\nStarting chat session. Press Ctrl+C to exit.")

        while True:
            try:
                # 使用 anyio 在线程中运行 input，避免阻塞事件循环
                query = await anyio.to_thread.run_sync(input, "\nQuery: ")

                # 如果输入为空，则直接进入下一次循环
                if not query.strip():
                    continue

                # 处理查询并打印结果
                response = await self.process_query(query)
                print(f"\n{response}")

            except KeyboardInterrupt:
                # 捕获到 Ctrl+C 时，打印一个换行符以保持格式整洁，然后跳出循环
                print()
                break
            except Exception:
                import traceback # type: ignore
                # 保留通用的异常捕获
                print("\nAn error occurred:")
                traceback.print_exc()
        
        print("Goodbye!")

    
    async def cleanup(self):
        """Clean up resources"""
        await self.exit_stack.aclose()


def qa_one_sync(query: str, callback=None) -> str:
    """
    一个同步的(非 async)单轮问-答方法。

    它在内部启动一个临时的事件循环来运行所有异步的客户端操作，
    并阻塞式地等待最终结果返回。

    Args:
        query (str): 要发送给模型的查询。
        callback (Callable, optional): 一个可选的同步回调函数，它将接收最终响应作为参数。

    Returns:
        str: 模型的最终文本响应。
    """

    # 2. 将所有需要 await 的异步操作，都封装在一个内部的 async 函数中
    async def _async_wrapper():
        from transform_server import app as server_app
        # 这里面的代码就是您原来 async qa_one 的完整逻辑
        client = MCPClient()
        try:
            print(f"\nQuery: {query}")

            # 使用我们最终确定的、在单进程内部分发任务的连接方式
            await client.connect_to_server(server_app)
            
            response = await client.process_query(query)
            
            print(f"\n{response}")
            
            if callback:
                callback(response)
            
            return response
        finally:
            await client.cleanup()

    # 3. 使用 asyncio.run() 作为桥梁，来启动并运行异步逻辑，然后返回其结果
    try:
        return asyncio.run(_async_wrapper())
    except RuntimeError as e:
        # 如果当前线程已经有一个正在运行的事件循环，asyncio.run()会报错
        # 这种情况在某些复杂应用（如Jupyter, GUI框架）中可能出现
        print(f"错误：无法启动新的事件循环，可能已经有一个正在运行。错误信息: {e}")
        print("在这种情况下，您需要从一个异步上下文中调用原始的 async qa_one 方法。")
        return "执行异步操作失败。"

async def main():
    from transform_server import app as server_app
    client = MCPClient()
    try:
        # 将导入的 app 实例传递给 connect_to_server
        await client.connect_to_server(server_app)
        await client.chat_loop()
    finally:
        await client.cleanup()


if __name__ == "__main__":
    asyncio.run(main())