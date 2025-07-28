from PyQt6.QtCore import Qt, QPoint, QEvent, pyqtSignal, QRect, QTimer
from PyQt6.QtWidgets import QMainWindow, QApplication, QWidget,QDockWidget,QVBoxLayout
from PyQt6.QtGui import QColor, QGuiApplication, QPixmap, QPainter
from PyQt6.QtWebChannel import QWebChannel
from PyQt6.QtWebEngineWidgets import QWebEngineView
from PyQt6.QtWebEngineCore import QWebEngineProfile, QWebEngineSettings
import Bridge
import os
import sys
import json

try:
    import CabbageEngine
    print("import CabbageEngine")
except ImportError:
    from CabbageEngineFallback import CabbageEngine

from StaticComponents import scene_dict,url

class CustomWindow(QMainWindow):
    def __init__(self, parent=None):
        super(CustomWindow, self).__init__(parent)
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint | Qt.WindowType.Tool)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setStyleSheet("background-color: rgba(0, 0, 0, 0);")

class MainWindow(QMainWindow):
    def __init__(self):
        self.osd = None
        super(MainWindow, self).__init__()
        screen = QApplication.primaryScreen().availableGeometry()
        self.setGeometry(0, 0, screen.width(), screen.height())
        self.setWindowTitle("CabbageEngine")
        self.configure_web_engine()

        self.RenderWidget = RenderWidget(self)
        self.setCentralWidget(self.RenderWidget)

        self.osd = CustomWindow(self)
        self.osd.resize(self.size())
        self.osd.move(self.geometry().x(), self.geometry().y())
        #正常使用
        self.BrowserWidget = BrowserWidget(self.osd)
        self.osd.setCentralWidget(self.BrowserWidget)

        self.osd.show()

    def changeEvent(self, event):
        """处理窗口状态变化事件"""
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

    def moveEvent(self, event):
        """处理窗口移动事件"""
        x = int(event.pos().x() - event.oldPos().x())
        y = int(event.pos().y() - event.oldPos().y())
        if self.osd:
            self.osd.move(self.osd.pos().x() + x, self.osd.pos().y() + y)
        super().moveEvent(event)

    def reloadWidget(self):
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

    def closeEvent(self, event):
        QApplication.instance().quit()
        event.accept()
        os._exit(0)
    
    def resizeEvent(self,event):
        self.osd.resize(self.size())
        super().resizeEvent(event)

    def configure_web_engine(self):
        profile = QWebEngineProfile.defaultProfile()
        # 清除现有缓存
        profile.clearHttpCache()
        # 配置页面设置
        settings = profile.settings()
        settings.setAttribute(QWebEngineSettings.WebAttribute.JavascriptEnabled, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.LocalStorageEnabled, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.WebGLEnabled, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.AutoLoadImages, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.Accelerated2dCanvasEnabled, False)
        # 添加其他性能优化设置
        settings.setAttribute(QWebEngineSettings.WebAttribute.PlaybackRequiresUserGesture, True)
        settings.setAttribute(QWebEngineSettings.WebAttribute.PdfViewerEnabled, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.PluginsEnabled, False)
        settings.setAttribute(QWebEngineSettings.WebAttribute.ShowScrollBars,False)



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

class BrowserWidget(QWebEngineView):
    def __init__(self, Main_Window):
        super(BrowserWidget, self).__init__(Main_Window)
        self.Main_Window = Main_Window
        self.CentralManager = Bridge.CentralManager()

        self.setMinimumSize(1, 1)
        self.setStyleSheet("background: transparent;")
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)
        self.page().setBackgroundColor(QColor(Qt.GlobalColor.transparent))
        self.load(url)
        self.setContentsMargins(0, 0, 0, 0)

        self._setup_web_channel()
        self._connect_signals()

    def _setup_web_channel(self):
        self.channel = QWebChannel()
        self.bridge = Bridge.Bridge(self.CentralManager)
        self.channel.registerObject("pyBridge", self.bridge)
        self.page().setWebChannel(self.channel)

    def _connect_signals(self):
        self.bridge.create_route.connect(self.AddDockWidget)
        self.bridge.remove_route.connect(self.RemoveDockWidget)

    def AddDockWidget(self, routename, routepath, position, floatposition, size):
        if not routename or not routepath:
            print("错误：routename 和 routepath 不能为空")
            return
        browser = QWebEngineView()
        dock_area, isFloat, pos = self._get_dock_area(position, floatposition)

        if self.CentralManager.docks.get(routename):
            self.RemoveDockWidget(routename)
            del self.CentralManager.docks[routename]
            return

        try:
            self.dock = AddDock(browser, routename, routepath, self.CentralManager, self.Main_Window, isFloat)
            if isFloat:
                self.dock.bridge.create_route.connect(lambda *args: self.AddDockWidget(*args))
                self.dock.bridge.remove_route.connect(self.RemoveDockWidget)
                if size:
                    self.dock.resize(size.get("width"),size.get("height"))
                    self.dock.browser.resize(size.get("width"),size.get("height"))
                self.dock.setWindowFlags(self.dock.windowFlags() | Qt.WindowType.WindowStaysOnTopHint)
                self.dock.move(pos)
                self.dock.show()
            else:
                self.Main_Window.addDockWidget(dock_area,self.dock)
                self.dock.bridge.create_route.connect(lambda *args: self.AddDockWidget(*args))
                self.dock.bridge.remove_route.connect(self.RemoveDockWidget)
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

    def _get_dock_area(self, position, floatposition):
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
            return float_position_map.get(floatposition.lower(), (Qt.DockWidgetArea.AllDockWidgetAreas, True, "top_left"))

        return position_map.get(
            position.lower(), (Qt.DockWidgetArea.LeftDockWidgetArea, False, None)
        )


class AddDock(QDockWidget):
    def __init__(self, browser, name, path, CentralManager, Main_Window, isFloat):
        super(AddDock, self).__init__(name, Main_Window)
        self.Main_Window = Main_Window
        self.max_width = int(Main_Window.width() * 0.3)
        self.min_height = int(Main_Window.height() * 0.5)
        self.browser = browser
        self.isFloat = isFloat
        self.centralmanager = CentralManager
        self.name = name
        self.worker_threads = []

        url.setFragment(path)

        self._setup_ui()
        self._setup_web_channel()
        self._connect_signals()

        if isFloat:
            self.setFloating(True)
            self.show()

    def _setup_ui(self):
        self.setMinimumSize(1, 1)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground, True)
        self.round_corner_stylesheet = """
            QDockWidget {
                background: rgba(0, 0, 0, 0); 
                border: 8px solid rgba(100, 100, 100, 150);
                border-radius: 5px;
                padding: 4px;
            }
            QDockWidget[floating="true"] {
                border: 8px solid rgba(120, 120, 120, 200);
                padding: 4px;
            }
            QDockWidget::title {
                height: 0px;
            }
        """
        self.setMaximumWidth(self.max_width)
        self.setMinimumHeight(self.min_height)
        self.setStyleSheet(self.round_corner_stylesheet)
        self.setTitleBarWidget(QWidget())
        self.setContentsMargins(0, 0, 0, 0)

        self.browser.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.browser.setStyleSheet("background: transparent;")
        self.browser.page().setBackgroundColor(QColor(Qt.GlobalColor.transparent))
        self.browser.setContextMenuPolicy(Qt.ContextMenuPolicy.NoContextMenu)
        self.browser.load(url)

        self.setWidget(self.browser)

    def _setup_web_channel(self):
        self.channel = QWebChannel()
        self.bridge = Bridge.Bridge(self.centralmanager)
        self.channel.registerObject("pyBridge", self.bridge)
        self.browser.page().setWebChannel(self.channel)
        self.centralmanager.register_dock(self.name, self)

    def _connect_signals(self):
        self.bridge.ai_response.connect(self.send_ai_message_to_js)
        self.bridge.dock_event.connect(self.dock_event)
        self.topLevelChanged.connect(self.handle_top_level_change)
        self.destroyed.connect(self.cleanup_resources)

    def dock_event(self, event_type, event_data):
        match event_type:
            case "drag" if self.isFloating():
                try:
                    data = json.loads(event_data)
                    current_pos = self.pos()
                    new_x = current_pos.x() + data["deltaX"]
                    new_y = current_pos.y() + data["deltaY"]
                    self.move(new_x, new_y)
                except Exception as e:
                    print(f"处理拖拽事件失败: {str(e)}")
            case "close":
                self.close()
            case "float":
                data = json.loads(event_data)
                self.setFloating(data["isFloating"])
                self.raise_()
            case "resize":
                try:
                    data = json.loads(event_data)
                    x = int(data.get("x", self.pos().x()))
                    y = int(data.get("y", self.pos().y()))
                    width = int(data["width"])
                    height = int(data["height"])
                    self.move(x, y)
                    self.resize(width, height)
                    self.update()
                except Exception as e:
                    print(f"处理resize事件失败: {str(e)}")
            case _:
                pass

    def handle_top_level_change(self):
        if self.isFloating():
            self.setStyleSheet(self.round_corner_stylesheet)
            self.setFeatures(
                QDockWidget.DockWidgetFeature.DockWidgetFloatable
                | QDockWidget.DockWidgetFeature.DockWidgetMovable
                | QDockWidget.DockWidgetFeature.DockWidgetClosable
            )
            self.setMaximumWidth(16777215)
            self.setMinimumHeight(1)
        else:
            self.setStyleSheet(self.round_corner_stylesheet)
            self.setMaximumWidth(self.max_width)
            self.setMinimumHeight(self.min_height)
            if hasattr(self, "browser"):
                self.browser.update()

    def send_message_to_dock(self,json_data):
        self.bridge.dock_event.emit("jsonData", json_data)

    def send_ai_message_to_js(self, message):
        try:
            if not isinstance(message, str):
                message = str(message)
            try:
                json.loads(message)
                js_code = f"window.receiveAIMessage({message})"
            except:
                js_code = f"window.receiveAIMessage({json.dumps({'content': message})})"

            QTimer.singleShot(0, lambda: self.browser.page().runJavaScript(js_code))
        except Exception as e:
            print(f"发送消息到JS失败: {str(e)}")

    def cleanup_resources(self):
        try:
            if hasattr(self, "browser"):
                self.browser.deleteLater()
                print(f"清理浏览器资源: {self.name}")
            if hasattr(self, "channel"):
                self.channel.deregisterObject("pyBridge")
            self.centralmanager.delete_dock(self.name)
        except Exception as e:
            print(f"资源清理异常: {str(e)}")

    def closeEvent(self, event):
        try:
            for thread in self.worker_threads:
                thread.quit()
                thread.wait()
            self.worker_threads.clear()
        except Exception as e:
            print(f"关闭事件处理异常: {str(e)}")
        super().closeEvent(event)

class RemoveDock(QWidget):
    def __init__(self, browser, name, central_manager):
        super(RemoveDock, self).__init__()
        self.centralmanager = central_manager
        self.browser = browser
        dock = self.centralmanager.docks.get(name)

        if dock:
            print(f"[DEBUG] 开始删除 {name}")
            dock.setAttribute(Qt.WidgetAttribute.WA_DeleteOnClose)

            def step1():
                if dock and dock.isWidgetType():
                    content = dock.widget()
                    if content:
                        print(f"[DEBUG] Step1 清理内容 {name}")
                        content.hide()
                        try:
                            if content.page():
                                content.page().setWebChannel(None)
                        except RuntimeError:
                            pass
                        content.setParent(None)
                QTimer.singleShot(50, step2)

            def step2():
                try:
                    if dock and dock.isWidgetType() and dock.isVisible():
                        print(f"[DEBUG] Step2 删除dock {name}")
                        dock.hide()
                        dock.setParent(None)
                        dock.deleteLater()
                except RuntimeError as e:
                    print(f"[WARN] 对象已提前删除: {str(e)}")

                if name in self.centralmanager.docks:
                    del self.centralmanager.docks[name]

                QTimer.singleShot(50, step3)

            def step3():
                print(f"[DEBUG] Step3 最终确认 {name}")

            QTimer.singleShot(0, step1)


app = QApplication(sys.argv)
window = MainWindow()
window.show()