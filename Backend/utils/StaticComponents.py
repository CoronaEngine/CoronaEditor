from logging import root
import os
from PyQt6.QtCore import QUrl

root_dir = os.path.split(os.path.split(os.path.split(os.path.abspath(__file__))[0])[0])[0]
html_path = os.path.join(root_dir, "Frontend", "dist", "index.html")
obj_dir = os.path.join(root_dir, "TestCase", "AddModelTest")
url = QUrl.fromLocalFile(html_path)
print(html_path)

try:
    import CoronaEngine
    print("import CoronaEngine")
except ImportError:
    from CoronaEngineFallback import CoronaEngine
    root_dir = os.path.split(os.path.split(os.path.split(os.path.split(os.path.abspath(__file__))[0])[0])[0])[0]
    html_path = os.path.join(
        root_dir,
        "CoronaEditor",
        "Frontend",
        "dist",
        "index.html",
    )
    url = QUrl.fromLocalFile(html_path)
    obj_dir = os.path.join(root_dir, "TestCase", "AddModelTest")
    print("import CoronaEngine Fallback")

scene_dict = {}

