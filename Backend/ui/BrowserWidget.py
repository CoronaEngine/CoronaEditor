from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtCore import Qt, QPoint
from PyQt6.QtGui import QColor, QGuiApplication
from utils.CentralManager import CentralManager
from utils.Bridge import Bridge
from ui.DockWidget import AddDock, RemoveDock

class BrowserWidget(QWebEngineView):
    def __init__(self, Main_Window, url:str):
        super(BrowserWidget, self).__init__(Main_Window)
        self.Main_Window = Main_Window
        self.CentralManager = CentralManager()
        self.url = url

        self.setMinimumSize(1, 1)
        self.setStyleSheet("background: transparent;")
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)
        self.page().setBackgroundColor(QColor(Qt.GlobalColor.transparent))
        self.load(self.url)
        self.setContentsMargins(0, 0, 0, 0)

        self.setup_web_channel()
        self.connect_signals()

    def setup_web_channel(self):
        self.channel = QWebChannel()
        self.bridge = Bridge(self.CentralManager)
        self.channel.registerObject("pyBridge", self.bridge)
        self.page().setWebChannel(self.channel)

    def connect_signals(self):
        self.bridge.create_route.connect(self.AddDockWidget)
        self.bridge.remove_route.connect(self.RemoveDockWidget)
        self.bridge.command_to_main.connect(self.handle_command_to_main)

    def AddDockWidget(self, routename, routepath, position, floatposition, size):
        if not routename or not routepath:
            print("错误：routename 和 routepath 不能为空")
            return
        browser = QWebEngineView()
        browser.is_main_browser = False
        dock_area, isFloat, pos = self.get_dock_area(position, floatposition)

        if self.CentralManager.docks.get(routename):
            self.RemoveDockWidget(routename)
            del self.CentralManager.docks[routename]
            return
        try:
            self.dock = AddDock(browser, routename, routepath, self.CentralManager, self.Main_Window, isFloat)
            self.dock.bridge.create_route.connect(lambda *args: self.AddDockWidget(*args))
            self.dock.bridge.remove_route.connect(self.RemoveDockWidget)
            self.dock.bridge.command_to_main.connect(self.handle_command_to_main)
            if isFloat:
                if size:
                    self.dock.resize(size.get("width"),size.get("height"))
                    self.dock.browser.resize(size.get("width"),size.get("height"))
                self.dock.setWindowFlags(self.dock.windowFlags() | Qt.WindowType.WindowStaysOnTopHint)
                self.dock.move(pos)
                self.dock.show()
            else:
                self.Main_Window.addDockWidget(dock_area,self.dock)

        except Exception as e:
            print(f"添加停靠窗口失败: {str(e)}")
            browser.deleteLater()

    def RemoveDockWidget(self, routename):
        browser = self.CentralManager.docks.get(routename)
        dock = self.CentralManager.docks.get(routename)
        if dock:
            self.Main_Window.removeDockWidget(dock)
            RemoveDock(browser, routename, self.CentralManager)

            if hasattr(dock, "bridge"):
                dock.bridge.create_route.disconnect()
                dock.bridge.remove_route.disconnect()

    def get_dock_area(self, position, floatposition):
        position_map = {
            "left": (Qt.DockWidgetArea.LeftDockWidgetArea, False, None),
            "right": (Qt.DockWidgetArea.RightDockWidgetArea, False, None),
            "top": (Qt.DockWidgetArea.TopDockWidgetArea, False, None),
            "bottom": (Qt.DockWidgetArea.BottomDockWidgetArea, False, None),
        }

        if position.lower() == "float":
            screen = QGuiApplication.primaryScreen()
            float_position_map = {
                "top_left": (Qt.DockWidgetArea.AllDockWidgetAreas, True, screen.geometry().topLeft()),
                "bottom_left": (Qt.DockWidgetArea.AllDockWidgetAreas, True, screen.geometry().bottomLeft()-QPoint(0,200)),
                "top_right": (Qt.DockWidgetArea.AllDockWidgetAreas, True, screen.geometry().topRight()-QPoint(150,0)),
                "bottom_right": (Qt.DockWidgetArea.AllDockWidgetAreas, True, screen.geometry().bottomRight()-QPoint(150,200)),
                "center": (Qt.DockWidgetArea.AllDockWidgetAreas, True, screen.geometry().center()),
            }
            return float_position_map.get(floatposition.lower(), (Qt.DockWidgetArea.AllDockWidgetAreas, True, screen.geometry().topLeft()))

        return position_map.get(
            position.lower(), (Qt.DockWidgetArea.LeftDockWidgetArea, False, None)
        )

    def handle_command_to_main(self, command_name, command_data):
        if command_name == "go_home":
            self.load(self.url)
            print(self.url)
