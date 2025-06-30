from PyQt5 import QtCore, QtGui, QtWidgets
from PyQt5.QtCore import *
from PyQt5.QtWidgets import QWidget, QApplication, QGridLayout, QLabel
from Tools.loggings import logger
import numpy

class InsideWindow(QWidget):
    CameraPosition = numpy.array([0.47, -2.1, 6.1])
    CameraForward = numpy.array([0.06, 0.49, -0.87])
    CameraWorldUp = numpy.array([0.0, 1.0, 0.0])
    CameraFov = 45.0
    CameraSpeed = 0.1
    firstMouse = True
    yaw = -120.0
    pitch = 0
    lastX = 600
    lastY = 360

    def __init__(self):
        super().__init__()
        self.initUI()
        

    def initUI(self):
        self.lableRender1 = QLabel(self)
        self.lableRender1.resize(1920, 1080)
        self.lableRender1.move(0, 0)
        self.lableRender1.setHidden(False)

        self.lableRender2 = QLabel(self)
        self.lableRender2.resize(1920, 1080)
        self.lableRender2.move(0, 0)
        self.lableRender2.setHidden(True)

        self.setWindowTitle("CabbageEngine")
        self.resize(1920, 1080)
        self.setMouseTracking(True)
        self.actorList = []


