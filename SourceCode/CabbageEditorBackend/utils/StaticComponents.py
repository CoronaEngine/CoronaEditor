from logging import root
import os
from PyQt6.QtCore import QUrl

root_dir = os.path.split(os.path.split(os.path.abspath(__file__))[0])[0]
html_path = os.path.join(root_dir, "CabbageEditorFrontend", "index.html")
obj_dir = os.path.join(root_dir, "TestCase", "AddModelTest")
url = QUrl.fromLocalFile(html_path)

try:
    import CabbageEngine
    print("import CabbageEngine")
except ImportError:
    from CabbageEngineFallback import CabbageEngine
    root_dir = os.path.split(os.path.split(os.path.split(os.path.split(os.path.split(os.path.abspath(__file__))[0])[0])[0])[0])[0]
    html_path = os.path.join(
        root_dir,
        "CabbageEditor",
        "SourceCode",
        "CabbageEditorFrontend",
        "dist",
        "index.html",
    )
    url = QUrl.fromLocalFile(html_path)
    obj_dir = os.path.join(root_dir, "TestCase", "AddModelTest")
    print("import CabbageEngine Fallback")

scene_dict = {}

