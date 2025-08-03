from PyQt6.QtCore import Qt, QPoint, QEvent
from PyQt6.QtWidgets import QMainWindow, QApplication
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEngineProfile, QWebEngineSettings
from utils.Bridge import Bridge
import os, sys
from utils.StaticComponents import scene_dict, url
from ui.CustomWindow import CustomWindow
from ui.RenderWidget import RenderWidget
from ui.BrowserWidget import BrowserWidget

class MainWindow(QMainWindow):
    def __init__(self):
        self.osd = None
        super(MainWindow, self).__init__()
        screen = QApplication.primaryScreen().availableGeometry()
        self.setGeometry(0, 0, screen.width(), screen.height())
        self.setWindowTitle("CabbageEngine")
        self.configure_web_engine()

        self.RenderWidget = RenderWidget(self, scene_dict)
        self.setCentralWidget(self.RenderWidget)

        self.osd = CustomWindow(self)
        self.osd.resize(self.size())
        self.osd.move(self.geometry().x(), self.geometry().y())

        self.BrowserWidget = BrowserWidget(self.osd, url)
        self.osd.setCentralWidget(self.BrowserWidget)

        self.osd.show()

    def changeEvent(self, event) -> None:
        if event.type() == QEvent.Type.WindowStateChange:
            if self.windowState() == Qt.WindowState.WindowMinimized:
                if self.osd:
                    self.osd.hide()
            elif (self.windowState() in (Qt.WindowState.WindowNoState, Qt.WindowState.WindowMaximized) and
                  event.oldState() == Qt.WindowState.WindowMinimized):
                if self.osd:
                    p = self.mapToGlobal(QPoint(0, 0))
                    self.osd.move(p.x(), p.y())
                    self.osd.show()
        super().changeEvent(event)

    def moveEvent(self, event) -> None:
        x = int(event.pos().x() - event.oldPos().x())
        y = int(event.pos().y() - event.oldPos().y())
        if self.osd:
            self.osd.move(self.osd.pos().x() + x, self.osd.pos().y() + y)
        super().moveEvent(event)

    def reloadWidget(self) -> None:
        central_widget = self.centralWidget()
        if central_widget:
            central_widget.setParent(None)

        for dock in self.findChildren(Bridge.QDockWidget):
            dock.setParent(None)

        for child in self.children():
            if isinstance(child, QWebEngineView):
                child.setParent(None)

        if self.BrowserWidget:
            self.BrowserWidget.setParent(None)
        self.BrowserWidget.url().clear()
        self.BrowserWidget = Bridge.BrowserWidget(self)
        self.setCentralWidget(self.BrowserWidget)

    def closeEvent(self, event) -> None:
        QApplication.instance().quit()
        event.accept()
        os._exit(0)
    
    def resizeEvent(self,event) -> None:
        self.osd.resize(self.size())
        super().resizeEvent(event)

    def configure_web_engine(self) -> None:
        profile = QWebEngineProfile.defaultProfile()
        settings = profile.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.ShowScrollBars, False)

app = QApplication(sys.argv)
window = MainWindow()
window.show()