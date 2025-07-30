from ui import MainWindow
import os
import sys
import importlib.util
import glob

#import CabbageEngine

_cleaned_up = False

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
    MainWindow.app.processEvents()

if __name__ == '__main__':
     print('python main')
     cleanup_blockly_files()
     while(True):
        MainWindow.app.processEvents()
