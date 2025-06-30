from mcp.server.fastmcp import FastMCP, Context
import logging
import json
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any, AsyncIterator
# from QtWindow import Bridge, scene_dict
import QtWindow
# print(QtWindow.__file__)
# print(dir(QtWindow))

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TransformMCPServer")

# Create shared bridge instance
qt_bridge = QtWindow.Bridge()


@asynccontextmanager
async def server_lifespan(server: FastMCP) -> AsyncIterator[Dict[str, Any]]:
    try:
        logger.info("TransformMCP server starting up")
        yield {}
    finally:
        logger.info("TransformMCP server shut down")

# MCP app
app = FastMCP(
    "TransformMCP",
    description="Transform server calling Qt actor operations",
    lifespan=server_lifespan,
)

def call_actor_operation(scene_name: str, actor_name: str, operation: str, x: float, y: float, z: float):
    data = json.dumps({
        "sceneName": scene_name,
        "actorName": actor_name,
        "Operation": operation,
        "x": x,
        "y": y,
        "z": z
    })
    qt_bridge.Actor_Operation(data)
    return f"Sent {operation}({x}, {y}, {z}) to actor '{actor_name}' in scene '{scene_name}'"

@app.tool()
async def transform_actor(actor_name: str, operation: str, x: float, y: float, z: float, scene_name: str="scene1") -> str:
    """
    Apply a transformation (Move/Rotate/Scale) to the  actor in the  scene.

    Args:
        actor_name: Name of the actor
        operation: One of 'Move', 'Rotate', 'Scale'
        x: X value
        y: Y value
        z: Z value
        scene_name: Name of the scene,默认为scene1
    """
    try:
        return call_actor_operation(scene_name, actor_name, operation, x, y, z)

    except Exception as e:
        logger.error(f"Error transforming actor: {str(e)}")
        return f"Error transforming actor: {str(e)}"


@app.tool()
async def list_actors(scene_name: str) -> str:
    """
    List all actor names in a specific scene.

    Args:
        scene_name: Name of the scene
    """
    try:
        # 角色名称缓存列表（用于 get_actor_list 工具）
        actor_list = []
        if scene_name in QtWindow.scene_dict:
            actor_dict = QtWindow.scene_dict[scene_name]['actor_dict']
            for actorname in actor_dict:
                actor_list.append(actorname)
        return json.dumps({"scene": scene_name, "actors": actor_list}, indent=2)
    except Exception as e:
        logger.error(f"Error listing actors: {str(e)}")
        return f"Error listing actors: {str(e)}"

def main():
    app.run()

if __name__ == "__main__":
    main()
