from PyQt6.QtWidgets import QMainWindow
from PyQt6.QtCore import Qt

class CustomWindow(QMainWindow):
    def __init__(self, parent=None):
        super(CustomWindow, self).__init__(parent)
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setStyleSheet("background-color: rgba(0, 0, 0, 0);")