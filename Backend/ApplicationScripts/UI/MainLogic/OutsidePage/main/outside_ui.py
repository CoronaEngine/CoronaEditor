import sys
from PyQt5 import QtCore, QtGui, QtWidgets
from PyQt5.QtCore import *
from PyQt5.QtWidgets import QWidget, QApplication, QGridLayout, QLabel, QVBoxLayout
from PyQt5.QtMultimedia import QAudioOutput, QMediaPlayer
from PyQt5.QtWidgets import *
from PyQt5.QtGui import QPixmap
import traceback
import os
import pygame
from Tools.settings import ui_source_path
from UI.MainLogic.OutsidePage.setting.setting_ui import SettingWindow
from UI.MainLogic.InsidePage.main.inside_ui import InsideWindow

img_path = os.path.join(ui_source_path, "imgs", "img.png")
mp3_path = os.path.join(ui_source_path, "sounds", "MyGO!!!!! - 春日影(MyGO!!!!! ver.).mp3")


# 背景图片，背景音乐设置（自定义代码）
class MyWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.init_ui()
        self.media_player = QMediaPlayer()
        self.pygame = pygame  # 初始化pygame属性
        self.pygame.init()  # 初始化pygame模块

    # 游戏背景图片，音乐播放控制按键
    def init_ui(self):
        self.setWindowTitle("游戏页面")
        self.setGeometry(100, 100, 800, 600)

        central_widget = QWidget(self)
        self.setCentralWidget(central_widget)

        # 创建一个 QLabel 用于显示背景图片
        background_label = QLabel(self)
        # 加载图片
        pixmap = QtGui.QPixmap(img_path)
        # 将图片设置为标签的背景
        background_label.setPixmap(pixmap)

        # 设置布局
        layout = QVBoxLayout(central_widget)
        layout.addWidget(background_label)

        # 设置 QLabel 的大小策略，使其适应全屏
        background_label.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        background_label.setScaledContents(True)

        # 创建按钮

        button = QPushButton(self)
        button.setGeometry(50, 50, 90, 50)  # 设置按钮位置和大小

        # 设置按钮的样式，使用本地图片作为背景
        button.setStyleSheet("QPushButton {"
                             "border-image: url('D:/python study/python qt/小喇叭.png');"
                             "}")

        self.setGeometry(100, 100, 300, 200)

        button.clicked.connect(self.play_pause_music)

        background_label.lower()
        button.raise_()
        button1 = QPushButton(self)
        button1.setGeometry(80, 660, 280, 55)
        button1.setStyleSheet("QPushButton{\n"
                              "\n"
                              "background:rgb(85, 85, 0);\n"
                              "font-color:rgb(176, 153, 117);\n"
                              "font: italic 24pt \"Monotype Corsiva\";\n"
                              "\n"
                              "}")
        button1.setObjectName("pushButton")
        button2 = QPushButton(self)
        button2.setGeometry(80, 740, 280, 55)
        button2.setStyleSheet("QPushButton{\n"
                              "\n"
                              "background:rgb(85, 85, 0);\n"
                              "font-color:rgb(176, 153, 117);\n"
                              "font: italic 24pt \"Monotype Corsiva\";\n"
                              "\n"
                              "}")
        button2.setObjectName("pushButton_2")
        button3 = QPushButton(self)
        button3.setGeometry(80, 820, 280, 55)
        button3.setStyleSheet("QPushButton{\n"
                              "\n"
                              "background:rgb(85, 85, 0);\n"
                              "font-color:rgb(176, 153, 117);\n"
                              "font: italic 24pt \"Monotype Corsiva\";\n"
                              "\n"
                              "}")
        button3.setObjectName("pushButton_3")
        button4 = QPushButton(self)
        button4.setGeometry(80, 900, 280, 55)
        button4.setStyleSheet("QPushButton{\n"
                              "\n"
                              "background:rgb(85, 85, 0);\n"
                              "font-color:rgb(176, 153, 117);\n"
                              "font: italic 24pt \"Monotype Corsiva\";\n"
                              "\n"
                              "}")
        button4.setObjectName("pushButton_4")
        _translate = QtCore.QCoreApplication.translate

        button1.setText(_translate("MainWindow", "开 始 游 戏"))
        button2.setText(_translate("MainWindow", "继 续 游 戏"))
        button3.setText(_translate("MainWindow", "设    置"))
        button4.setText(_translate("MainWindow", "离 开 游 戏"))

        # 关闭页面
        button4.clicked.connect(self.close)

        # 控件跳转游戏页面
        button2.clicked.connect((self.openInsideWindow))

        # 控件跳转设置页面
        button3.clicked.connect((self.openSettingWindow))

    # 跳转游戏页面功能槽
    def openInsideWindow(self):
        self.InsideWindow = InsideWindow()

        self.InsideWindow.show()
        # self.hide()

    # 跳转设置页面功能槽
    def openSettingWindow(self):
        self.SettingWindow = SettingWindow()

        self.SettingWindow.show()

        # self.hide()

    # 游戏页面
    # class GameWindow(QWidget):

    # 设置页面
    # class SettingWindow(QWidget):

    # 判断音乐是否播放
    def play_pause_music(self):
        # 判断音乐是否在播放
        if pygame.mixer.music.get_busy():
            # 如果正在播放，暂停音乐
            pygame.mixer.music.pause()
        else:
            # 如果没有播放或者暂停，开始播放音乐
            pygame.mixer.music.unpause()

    # 键盘事件，按esc进入/退出全屏
    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Escape:
            if self.isFullScreen():
                self.showNormal()
            else:
                self.showFullScreen()

    # 终端输入，打开窗口，游戏音乐设置
    def Music(self):
        # 初始化 Pygamess
        self.pygame.init()
        # 选择音乐文件
        self.music_file = mp3_path
        # 初始化 mixer 模块
        self.pygame.mixer.init()
        # 加载音乐文件
        self.pygame.mixer.music.load(self.music_file)
        # 播放音乐
        self.pygame.mixer.music.play(loops=-1)
        # 打开窗口
        input("在这里随便输入点什么来打开窗口：")


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MyWindow()
    window.Music()
    # 将窗口设置为全屏
    window.showFullScreen()
    sys.exit(app.exec())
