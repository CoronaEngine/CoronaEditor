import sys

from PyQt5 import QtCore, QtGui, QtWidgets
from PyQt5.QtCore import *
from PyQt5.QtWidgets import QWidget, QApplication, QGridLayout, QLabel, QVBoxLayout
from Tools.loggings import logger
from PyQt5.QtMultimedia import QAudioOutput, QMediaPlayer, QMediaContent
from PyQt5.QtMultimediaWidgets import QVideoWidget
import traceback
import os
from Tools.settings import ui_source_path
from UI.UI_collection import page_collection


class OutsideWindow(QWidget):

    def __init__(self):
        super().__init__()
        self.initUI()

    def initUI(self):

        # self.setGeometry(0, 0, 700, 400)
        self.setWindowTitle("OutsideWindow")
        self.resize(1920, 1080)
        self.setMouseTracking(True)

        self.layout = QVBoxLayout()

        self.videoWidget = QVideoWidget()
        self.videoWidget.resize(1080, 608)
        self.layout.addWidget(self.videoWidget)
        self.setLayout(self.layout)
        try:
            self.video = QMediaPlayer()


            self.video.setVideoOutput(self.videoWidget)
            self.video.setMedia(QMediaContent(QtCore.QUrl(os.path.join(ui_source_path, "videos", "test.mp4").replace('\\', '/'))))
            self.videoWidget.show()

        except:
            logger.error(traceback.print_exc())

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_S:
            self.video.play()
            logger.info(self.video.error())
        if event.key() == Qt.Key.Key_A:
            page_collection.show_ui("main")
            logger.info("show")


if __name__ == '__main__':
    app = QtWidgets.QApplication(sys.argv)
    outside_ui = OutsideWindow()
    outside_ui.show()
    app.exec()
