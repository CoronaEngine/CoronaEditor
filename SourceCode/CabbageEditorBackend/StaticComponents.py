import os
from PyQt6.QtCore import QUrl


os.environ["QT_DISABLE_DIRECT_COMPOSITION"] = "1"
os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu"
os.environ["QT_QUICK_BACKEND"] = "software" 
os.environ["QT_ANGLE_PLATFORM"] = "d3d11"
os.environ["QT_QPA_PLATFORM"] = "windows"

root_dir = os.path.split(os.path.split(os.path.abspath(__file__))[0])[0]
html_path = os.path.join(root_dir, "CabbageEditorFrontend", "index.html")
obj_dir = os.path.join(root_dir, "TestCase", "AddModelTest")
url = QUrl.fromLocalFile(html_path)

try:
    import CabbageEngine
    print("import CabbageEngine")
except ImportError:
    from CabbageEngineFallback import CabbageEngine
    root_dir = os.path.split(
        os.path.split(os.path.split(os.path.split(os.path.abspath(__file__))[0])[0])[0]
    )[0]
    html_path = os.path.join(
        root_dir,
        "SourceCode",
        "CabbageEditor",
        "CabbageEditorFrontend",
        "dist",
        "index.html",
    )
    url = QUrl.fromLocalFile(html_path)
    obj_dir = os.path.join(root_dir, "TestCase", "AddModelTest")
    print("import CabbageEngine Fallback")

scene_dict = {}

