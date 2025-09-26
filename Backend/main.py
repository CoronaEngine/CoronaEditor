import os
import sys
import importlib.util
import glob
import queue

os.environ["QT_DISABLE_DIRECT_COMPOSITION"] = "1"
os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu --disable-software-rasterizer --enable-native-gpu-memory-buffers=false --disable-gpu-compositing --disable-gpu-rasterization --disable-oop-rasterization"
os.environ["QT_QUICK_BACKEND"] = "software"
os.environ["QT_ANGLE_PLATFORM"] = "d3d11"
os.environ["QT_QPA_PLATFORM"] = "windows"

_cleaned_up = False

from ui import MainWindow

msg_queue = queue.Queue()

def cleanup_blockly_files():
    global _cleaned_up
    try:
        if _cleaned_up:
            return
            
        current_dir = os.path.dirname(os.path.abspath(__file__))
        runscript_path = os.path.join(current_dir, 'runScript.py')
        if os.path.exists(runscript_path):
            try:
                os.remove(runscript_path)
                print(f"已删除: {runscript_path}")
            except PermissionError:
                print(f"无法删除 {runscript_path}，文件可能被占用")
        
        script_dir = os.path.join(current_dir, 'script')
        if os.path.exists(script_dir):
            for file in glob.glob(os.path.join(script_dir, 'blockly_code_*.py')):
                try:
                    os.remove(file)
                    print(f"已删除: {file}")
                except PermissionError:
                    print(f"无法删除 {file}，文件可能被占用")
                    
        _cleaned_up = True
    except Exception as e:
        print(f"清理Blockly文件时出错: {str(e)}")

def run(isReload):
    global _cleaned_up
    if not _cleaned_up:
        cleanup_blockly_files()

    if(isReload):
        for module_name in list(sys.modules.keys()):
            if 'runScript' in module_name or 'script' in module_name:
                del sys.modules[module_name]
        print("python hotfix")
    runscript_spec = importlib.util.find_spec("runScript")
    if runscript_spec is not None:
        runScript = importlib.util.module_from_spec(runscript_spec)
        runscript_spec.loader.exec_module(runScript)
        runScript.run()

    if not msg_queue.empty():
        print(msg_queue.get())

    MainWindow.app.processEvents()


def put_queue(msg):
    msg_queue.put(msg)

if __name__ == '__main__':
     print('python main')
     cleanup_blockly_files()
     while(True):
        MainWindow.app.processEvents()
