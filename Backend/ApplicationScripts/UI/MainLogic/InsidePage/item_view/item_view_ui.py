from PyQt5 import QtCore, QtGui, QtWidgets
from PyQt5.QtCore import *
from PyQt5.QtWidgets import QWidget, QApplication, QGridLayout, QLabel
from Tools.loggings import logger



class ItemViewWindow(QWidget):


    def __init__(self):
        super().__init__()
        self.initUI()


    def initUI(self):
        self.lableRender = QLabel(self)
        self.lableRender.resize(1920, 1080)
        self.lableRender.move(0, 0)

        self.setWindowTitle("ItemViewWindow")
        self.resize(1920, 1080)
        self.setMouseTracking(True)