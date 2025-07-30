from PyQt6.QtWidgets import QWidget
from PyQt6.QtCore import QRect, pyqtSignal
from PyQt6.QtGui import QPainter, QPixmap
import os
from utils.StaticComponents import scene_dict

try:
    import CabbageEngine
    print("import CabbageEngine")
except ImportError:
    from CabbageEngineFallback import CabbageEngine

class RenderWidget(QWidget):
    geometry_changed = pyqtSignal(QRect)

    def __init__(self, Main_Window):
        super(RenderWidget, self).__init__()
        self.Main_Window = Main_Window

        self.setGeometry(0, 0, self.Main_Window.width(), self.Main_Window.height())
        self.setStyleSheet("QLabel {background-color: transparent;}")
        self.mainscene = CabbageEngine.Scene(
            int(self.winId()),False
        )
        self.mainscene.setCamera(
            [0.0, 5.0, 10.0], [0.0, 1.5, 0.0], [0.0, -1.0, 0.0], 45.0
        )
        print(self.mainscene)
        scene_dict["mainscene"]={
            "scene":self.mainscene,
            "actor_dict":{}
        }

        self.image_path = os.path.join(os.path.dirname(__file__), "background")
        self.pixmap = None
        if self.image_path:
            self.pixmap = QPixmap(self.image_path)
            self.update()

    def paintEvent(self, event):
        if self.pixmap:
            painter = QPainter(self)
            painter.drawPixmap(self.rect(), self.pixmap)

    def scene(self):
        return self.winId()