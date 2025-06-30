import os

from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QPixmap, QScreen, QGuiApplication
from PyQt5.QtWidgets import QApplication, QWidget, QMainWindow, QVBoxLayout, QLabel
import sys

from Tools.settings import ui_source_path
from inside_ui_2 import Ui_Form


class MyForm(QWidget, Ui_Form):

    def __init__(self):
        super().__init__()
        self.setupUi(self)

        self.zoomed_window = None
        img = os.path.join(ui_source_path, "imgs", "map.jpg")
        self.pixmap = QPixmap(img)


    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_M:
            self.showZoomedImage()

        if event.key() == Qt.Key.Key_V:
            print("检视")

        if event.key() == Qt.Key.Key_F:
            print("交互/拾取")

    def showZoomedImage(self):
        try:
            self.zoomed_window = ZoomedWindow(self.pixmap)
            self.zoomed_window.show()

        except Exception as e:
            print(f"An error occurred: {e}")

class ZoomedWindow(QMainWindow):
    def __init__(self, pixmap):
        super().__init__()

        # 创建主窗口部件和布局
        central_widget = QWidget(self)
        self.setCentralWidget(central_widget)
        layout = QVBoxLayout(central_widget)

        # 创建 QLabel 控件并设置放大的图片
        self.zoomed_label = QLabel(self)


        # 将图片缩放到铺满整个屏幕
        screen_size = QApplication.primaryScreen().size()
        scaled_pixmap = pixmap.scaled(QSize(screen_size.width(), screen_size.height()))

        # 在 QLabel 中显示缩放后的图片
        self.zoomed_label.setPixmap(scaled_pixmap)
        # 将 QLabel 添加到布局
        layout.addWidget(self.zoomed_label)

        # 设置主窗口属性
        self.setWindowTitle("map Image")
        self.setGeometry(200, 200, 400, 300)  # 设置窗口大小

        # 获取主屏幕（屏幕索引为 0）的信息
        screens = QGuiApplication.screens()
        if screens:
            primary_screen = screens[0]
            screen_geometry = primary_screen.geometry()

            # 获取屏幕左上角坐标
            screen_left = screen_geometry.left()
            screen_top = screen_geometry.top()

            # 设置主窗口的位置，使其左上角与屏幕左上角对齐
            self.move(screen_left, screen_top)

if __name__ == '__main__':

    app = QApplication(sys.argv)
    inside_ui = MyForm()
    inside_ui.setWindowTitle('inside_ui')
    inside_ui.show()
    sys.exit(app.exec())
