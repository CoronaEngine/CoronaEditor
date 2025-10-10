from pathlib import Path
from PyQt6.QtCore import QUrl

root_dir = Path(__file__).resolve().parents[3]
html_path = root_dir / "CabbageEditor" / "Frontend" / "dist" / "index.html"
url = QUrl.fromLocalFile(str(html_path))

try:
    import CoronaEngine  # type: ignore
    print("[StaticComponents] import CoronaEngine")
except ImportError:
    try:
        from CoronaEngineFallback import CoronaEngine  # type: ignore
        print("[StaticComponents] import CoronaEngineFallback")
    except ImportError:
        print("[StaticComponents] CoronaEngine 未找到 (需要 -DBUILD_CORONA_EDITOR=ON)")


scene_dict = {}

