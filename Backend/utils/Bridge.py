from logging import root
from PyQt6.QtCore import QThread, pyqtSignal, pyqtSlot, QObject
from PyQt6.QtWidgets import QApplication
import json, os, time

import traceback

from mcp_client import qa_one_sync
from utils.StaticComponents import root_dir, scene_dict
from utils.FileHandleComponent import FileHandler

try:
    import CoronaEngine
    print("import CoronaEngine")
except ImportError:
    from CoronaEngineFallback import CoronaEngine

class WorkerThread(QThread):
    finished = pyqtSignal()
    result_ready = pyqtSignal(object)
    
    def __init__(self, func, *args, **kwargs):
        super().__init__()
        self.func = func
        self.args = args
        self.kwargs = kwargs

    def run(self):
        try:
            result = self.func(*self.args, **self.kwargs)
            self.result_ready.emit(result)
        except Exception as e:
            print(f"Worker thread error: {str(e)}")
        finally:
            self.finished.emit()


class Bridge(QObject):
    create_route = pyqtSignal(str, str, str, str, object)
    ai_message = pyqtSignal(str)
    remove_route = pyqtSignal(str)
    ai_response = pyqtSignal(str)
    dock_event = pyqtSignal(str, str)
    command_to_main = pyqtSignal(str, str)
    script_dir = os.path.join(root_dir, "CabbageEditor", "script")
    saves_dir = os.path.join(root_dir, "CabbageEditor", "saves")
    os.makedirs(script_dir, exist_ok=True)
    os.makedirs(saves_dir, exist_ok=True)
    obj_dir = ""

    def __init__(self, central_manager=None):
        super().__init__()
        self.camera_position = [0.0, 5.0, 10.0]
        self.camera_forward = [0.0, 1.5, 0.0]
        self.central_manager = central_manager

    @pyqtSlot(str, str, str, str, str)
    def addDockWidget(self, routename, routepath, position="left", floatposition="None",size=None):
        try:
            if isinstance(size, str):
                size = json.loads(size)
        except json.JSONDecodeError:
            size = None
        self.create_route.emit(routename, routepath, position, floatposition, size)

    @pyqtSlot(str)
    def removeDockWidget(self, routename):
        self.remove_route.emit(routename)

    @pyqtSlot(str,str)
    def createActor(self, scene_name, obj_path):
        name = os.path.basename(obj_path)
        object = CoronaEngine.Actor(scene_dict[scene_name]["scene"], obj_path)
        scene_dict[scene_name]["actor_dict"][name]={
            "actor":object,
            "path":obj_path
        }

    @pyqtSlot()
    def removeActor(self):
        scene_dict["mainscene"] = {
            "scene": None,
            "actor_dict": {}
        }

    @pyqtSlot(str)
    def createScene(self, data):
        scene_name = json.loads(data).get("sceneName")
        if scene_name not in scene_dict:
            scene_dict[scene_name] = {
                "scene": CoronaEngine.Scene(),
                "actor_dict": {}
            }
        else:
            print(f"场景已存在: {scene_name}")

    @pyqtSlot(str,str)
    def sendMessageToDock(self, routename, json_data):
        try:
            self.central_manager.send_json_to_dock(routename, json_data)
        except json.JSONDecodeError:
            print("发送消息失败：无效的JSON字符串")
        except Exception as e:
            print(f"发送消息失败: {str(e)}")

    @pyqtSlot(str)
    def sendMessageToAI(self, ai_message: str):
        """
        接收来自UI的信号，将消息放入一个工作线程中去请求AI，
        并通过信号将结果发回UI。
        """

        def ai_work() -> str:
            """
            这个函数将在后台工作线程中执行，因此可以安全地调用阻塞函数。
            """
            try:
                # 1. 解析传入的JSON消息
                msg_data = json.loads(ai_message)
                query = msg_data.get("message", "")

                # 2. 【核心修改】直接调用我们之前创建的同步版本 qa_one_sync。
                #    这个函数会阻塞，直到AI返回结果，但这只会阻塞后台线程，不会影响UI。
                response_text = qa_one_sync(query=query)

                # 3. 将AI返回的纯文本结果包装成标准的成功JSON格式
                final_response = {
                    "type": "ai_response",
                    "content": response_text,
                    "status": "success",
                    "timestamp": int(time.time()),
                }
                return json.dumps(final_response)

            except Exception as e:
                # 4. 如果发生任何错误（网络问题、解析失败等），包装成标准的错误JSON格式
                error_response = {
                    "type": "error",
                    "content": str(e),
                    "status": "error",
                    "timestamp": int(time.time()),
                }
                return json.dumps(error_response)

        # 您原有的WorkerThread启动逻辑完全正确，保持不变
        self.worker_thread = WorkerThread(ai_work)
        self.worker_thread.result_ready.connect(self.ai_response.emit)
        self.worker_thread.start()

    @pyqtSlot(str, str)
    def openFileDialog(self, sceneName, file_type="model"):
        file_handler = FileHandler()
        if file_type == "model":
            _, file_path = file_handler.open_file("选择模型文件", "3D模型文件 (*.obj *.fbx *.dae)")
            if file_path:
                try:
                    print(f"选择的模型文件路径: {file_path}")
                    name = os.path.basename(file_path)
                    object = CoronaEngine.Actor(scene_dict[sceneName]["scene"], file_path)
                    scene_dict[sceneName]["actor_dict"][name] = {
                        "actor": object,
                        "path": file_path
                    }
                    response = {
                        "name": name,
                        "path": file_path,
                    }
                    self.dock_event.emit("actorCreated", json.dumps(response))
                except Exception as e:
                    print(f"创建角色失败: {str(e)}")
        elif file_type == "scene":
            content, file_path = file_handler.open_file("选择场景文件", "场景文件 (*.json)")
            if file_path:
                try:
                    scene_dict[sceneName]["actor_dict"] = {}
                    scene_data = json.loads(content)
                    actors = []
                    for actor in scene_data.get("actors", []):
                        path = actor.get("path")
                        if path:
                            actor_obj = CoronaEngine.Actor(scene_dict[sceneName]["scene"], path)
                            name = os.path.basename(path)
                            scene_dict[sceneName]["actor_dict"][name] = {
                                "name": name,
                                "actor": actor_obj,
                                "path": path
                            }
                            actors.append({
                                "name": name,
                                "path": path
                            })
                    self.dock_event.emit("sceneLoaded", json.dumps({"actors": actors}))
                except Exception as e:
                    print(f"加载场景失败: {str(e)}")
                    error_response = {"type": "error", "message": str(e)}
                    self.dock_event.emit("sceneError", json.dumps(error_response))

    @pyqtSlot(str, str)
    def send_message_to_main(self, command_name, command_data):
        try:
            self.command_to_main.emit(command_name, command_data)
        except Exception as e:
            print(f"send_message_to_main failed: {str(e)}")

    @pyqtSlot(str,str)
    def actorDelete(self, sceneName, actorName):
        try:
            if actorName not in scene_dict[sceneName]["actor_dict"]:
                print(f"当前场景中的角色列表: {list(scene_dict[sceneName]['actor_dict'].keys())}")
                raise ValueError(f"角色 '{actorName}' 不在场景 '{sceneName}' 中")
            del scene_dict[sceneName]["actor_dict"][actorName]
            print(f"成功移除角色: {actorName}")
        except Exception as e:
            print(f"Actor delete failed: {str(e)}")
            return str(e)

    @pyqtSlot(str)
    def actorOperation(self,data):
        try:
            Actor_data = json.loads(data)
            sceneName = Actor_data.get("sceneName")
            actorName = Actor_data.get("actorName")
            Operation = Actor_data.get("Operation")
            x = float(Actor_data.get("x",0.0))
            y = float(Actor_data.get("y",0.0))
            z = float(Actor_data.get("z",0.0))
            match Operation:
                case "Scale":
                    CoronaEngine.Actor.scale(scene_dict[sceneName]["actor_dict"][actorName]["actor"],[x,y,z])
                case "Move":
                    CoronaEngine.Actor.move(scene_dict[sceneName]["actor_dict"][actorName]["actor"],[x,y,z])
                case "Rotate":
                    CoronaEngine.Actor.rotate(scene_dict[sceneName]["actor_dict"][actorName]["actor"],[x,y,z])
        except Exception as e:
            print(f"Actor transform error: {str(e)}")
            return

    @pyqtSlot(str)
    def cameraMove(self, data):
        try:
            move_data = json.loads(data)
            sceneName = move_data.get("sceneName", "scene1")
            position = move_data.get("position", [0.0, 5.0, 10.0])
            forward = move_data.get("forward", [0.0, 1.5, 0.0])
            up = move_data.get("up", [0.0, -1.0, 0.0])
            fov = float(move_data.get("fov", 45.0))
            CoronaEngine.Scene.setCamera(scene_dict[sceneName]["scene"],position, forward, up, fov)
        except Exception as e:
            print(f"摄像头移动错误: {str(e)}")

    @pyqtSlot(str)
    def sunDirection(self, data):
        try:
            sun_data = json.loads(data)
            sceneName = sun_data.get("sceneName","scene1")
            px = float(sun_data.get("px", 1.0))
            py = float(sun_data.get("py", 1.0))
            pz = float(sun_data.get("pz", 1.0))
            direction = [px, py, pz]
            CoronaEngine.Scene.setSunDirection(scene_dict[sceneName]["scene"],direction)
        except Exception as e:
            error_response = {"type": "error", "message": str(e)}
            self.dock_event.emit("sunDirectionError", json.dumps(error_response))

    @pyqtSlot(str, int)
    def executePythonCode(self, code, index):
        try:
            filename = f"blockly_code_{index}.py"
            filepath = os.path.join(self.script_dir, filename)
            indented_code = "\n".join(
                f"    {line}" if line.strip() else line for line in code.split("\n")
            )
            fullcode = f"""
try:
    import CoronaEngine
except ImportError:
    from CoronaEngineFallback import CoronaEngine

def run():
{indented_code}
                """
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(fullcode)

            # 创建runScript.py
            run_script_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "runScript.py"
            )
            script_files = []
            for f in os.listdir(self.script_dir):
                if f.startswith("blockly_code_") and f.endswith(".py"):
                    script_files.append(f.replace(".py", ""))
            run_script_content = ""
            for script in script_files:
                run_script_content += f"import script.{script}\n"

            run_script_content += "\ndef run():\n"
            for script in script_files:
                run_script_content += f"    script.{script}.run()\n"

            with open(run_script_path, "w", encoding="utf-8") as f:
                f.write(run_script_content)
            print(f"[DEBUG] 脚本文件创建成功: {filepath}")
            print(f"[DEBUG] runScript.py创建/覆盖成功: {run_script_path}")
        except Exception as e:
            print(f"[ERROR] 执行Python代码时出错: {str(e)}")
            error_response = {
                "status": "error",
                "message": str(e),
                "stacktrace": traceback.format_exc(),  # 添加堆栈跟踪
            }
            self.dock_event.emit("scriptError", json.dumps(error_response))

    @pyqtSlot(str)
    def sceneSave(self, data):
        try:
            scene_data = json.loads(data)
            file_handler = FileHandler()

            content = json.dumps(scene_data,indent=4)
            save_path = file_handler.save_file(content,"保存场景文件","场景文件 (*.json)")
            if save_path:
                print(f"[DEBUG] 场景保存成功: {save_path}")
                self.dock_event.emit(
                    "sceneSaved", json.dumps({"status": "success", "filepath": save_path})
                )
            else:
                print("[DEBUG] 场景保存失败")
                self.dock_event.emit(
                    "sceneSaved", json.dumps({"status": "error", "filepath": save_path})
                )
        except Exception as e:
            print(f"[ERROR] 保存场景失败: {str(e)}")
            error_response = {
                "status": "error",
                "message": str(e)
            }
            self.dock_event.emit("sceneError", json.dumps(error_response))

    @pyqtSlot()
    def closeprocess(self):
        QApplication.quit()
        os._exit(0)

    @pyqtSlot(str, str)
    def forwardDockEvent(self, event_type, event_data):
        self.dock_event.emit(event_type, event_data)
