import traceback

# import CabbageEngine
from PyQt5 import QtCore, QtGui, QtWidgets
import sys
from PyQt5.QtCore import *
from PyQt5.QtWidgets import QWidget, QApplication, QGridLayout, QLabel, QVBoxLayout
import numpy
from Tools.loggings import logger
import random
import math

from UI.test_video import OutsideWindow
from UI.UI_collection import page_collection
from UI.MainLogic.InsidePage.main.inside_ui import InsideWindow


class Window(QWidget):
    # CameraPosition = numpy.array([0.47, -2.1, 6.1])
    # CameraForward = numpy.array([0.06, 0.49, -0.87])
    # CameraWorldUp = numpy.array([0.0, 1.0, 0.0])
    # CameraFov = 45.0
    # CameraSpeed = 0.1
    # firstMouse = True
    # yaw = -120.0
    # pitch = 0
    # lastX = 600
    # lastY = 360
    #

    def __init__(self):
        super().__init__()
        self.initUI()

    def initUI(self):
        self.lableRender = QLabel(self)
        self.lableRender.resize(1920, 1080)
        self.lableRender.move(0, 0)

        self.setWindowTitle("CabbageEngine")
        self.resize(1920, 1080)
        self.setMouseTracking(True)

        self.layout = QVBoxLayout()

        # self.actorList = []
        #
        # CabbageEngine.setFilmSize(self.lableRender.width(), self.lableRender.height())
        # CabbageEngine.setFilmSurface(int(self.lableRender.winId()), win32api.GetModuleHandle(None))
        #
        #
        # CabbageEngine.checkActorCollision(10, 20)
        # CabbageEngine.checkScreenActorIndex([150, 110])
        # CabbageEngine.getActorPostion(123)
        # CabbageEngine.setCamera(self.CameraPosition.tolist(), self.CameraForward.tolist(), self.CameraWorldUp.tolist(),self.CameraFov)
    #
    #
    # def mousePressEvent(self, e):
    #     self.lastX = e.globalPosition().x()
    #     self.lastY = e.globalPosition().y()
    #
    # def mouseMoveEvent(self, e):
    #     if (self.firstMouse == True):
    #         self.lastX = e.globalPosition().x()
    #         self.lastY = e.globalPosition().y()
    #         self.firstMouse = False
    #     xoffset = e.globalPosition().x() - self.lastX
    #     yoffest = self.lastY - e.globalPosition().y()
    #     self.lastX = e.globalPosition().x()
    #     self.lastY = e.globalPosition().y()
    #     sensitivity = 0.1
    #     xoffset *= sensitivity
    #     yoffest *= sensitivity
    #     self.yaw += xoffset
    #     self.pitch += yoffest
    #     if (self.pitch > 89.0):
    #         self.pitch = 89.0
    #     if (self.pitch < -89.0):
    #         self.pitch = -89.0
    #
    #     self.CameraForward[2] = numpy.cos(numpy.radians(self.yaw)) * numpy.cos(numpy.radians(self.pitch))
    #     self.CameraForward[1] = numpy.sin(numpy.radians(self.pitch))
    #     self.CameraForward[0] = numpy.sin(numpy.radians(self.yaw)) * numpy.cos(numpy.radians(self.pitch))
    #
    #     self.CameraForward = self.CameraForward / numpy.linalg.norm(self.CameraForward)
    #     logger.info(self.CameraForward)
    #     CabbageEngine.setCamera(self.CameraPosition.tolist(), self.CameraForward.tolist(), self.CameraWorldUp.tolist(),
    #                             self.CameraFov)

    def keyPressEvent(self, event):
        # 这里event.key（）显示的是按键的编码
        # print("test:" + str(event.key()))
        # 举例，这里Qt.Key_A注意虽然字母大写，但按键事件对大小写不敏感
        logger.info(event.key())
        # if event.key() == Qt.Key.Key_S:
        #     # print('test:w')
        #     self.CameraPosition[0] -= self.CameraSpeed * self.CameraForward[0]
        #     self.CameraPosition[1] -= self.CameraSpeed * self.CameraForward[1]
        #     self.CameraPosition[2] -= self.CameraSpeed * self.CameraForward[2]
        #     CabbageEngine.setCamera(self.CameraPosition.tolist(), self.CameraForward.tolist(),
        #                             self.CameraWorldUp.tolist(), self.CameraFov)
        # if event.key() == Qt.Key.Key_D:
        #     # print('test:a')
        #     print("...")
        #     left = numpy.cross(self.CameraForward, self.CameraWorldUp)
        #     self.CameraPosition += (self.CameraSpeed) * left
        #     CabbageEngine.setCamera(self.CameraPosition.tolist(), self.CameraForward.tolist(),
        #                             self.CameraWorldUp.tolist(), self.CameraFov)
        # if event.key() == Qt.Key.Key_W:
        #     # print('test:s')
        #     self.CameraPosition[0] += self.CameraSpeed * self.CameraForward[0]
        #     self.CameraPosition[1] += self.CameraSpeed * self.CameraForward[1]
        #     self.CameraPosition[2] += self.CameraSpeed * self.CameraForward[2]
        #     CabbageEngine.setCamera(self.CameraPosition.tolist(), self.CameraForward.tolist(),
        #                             self.CameraWorldUp.tolist(), self.CameraFov)
        # if event.key() == Qt.Key.Key_A:
        #     # print('test:d')
        #     right = numpy.cross(self.CameraForward, self.CameraWorldUp)
        #     self.CameraPosition -= (self.CameraSpeed) * right
        #     CabbageEngine.setCamera(self.CameraPosition.tolist(), self.CameraForward.tolist(),
        #                             self.CameraWorldUp.tolist(), self.CameraFov)
        #
        # if event.key() == Qt.Key.Key_U:
        #     now_position = [0,0,0]
        #     for index,num in enumerate(now_position):
        #         now_position[index] += self.CameraForward[index]
        #     logger.info(now_position)
        #     actorIndex = self.actorList[-1]
        #     CabbageEngine.moveActor(actorIndex, now_position)
        #
        # if event.key() == Qt.Key.Key_J:
        #     now_position = [0,0,0]
        #     for index,num in enumerate(now_position):
        #         now_position[index] -= self.CameraForward[index]
        #     logger.info(now_position)
        #     actorIndex = self.actorList[-1]
        #     CabbageEngine.moveActor(actorIndex, now_position)
        #
        # if event.key() == Qt.Key.Key_I:
        #     actorIndex = self.actorList[-1]
        #     CabbageEngine.rotateActor(actorIndex, 0.5, [0.0, 1.0, 0.0])
        #
        # if event.key() == Qt.Key.Key_K:
        #     actorIndex = self.actorList[-1]
        #     CabbageEngine.rotateActor(actorIndex, -0.5, [0.0, 1.0, 0.0])
        #
        # if event.key() == Qt.Key.Key_O:
        #     actorIndex = self.actorList[-1]
        #     CabbageEngine.scaleActor(actorIndex, [0.9, 0.9, 0.9])
        #
        # if event.key() == Qt.Key.Key_L:
        #     actorIndex = self.actorList[-1]
        #     CabbageEngine.scaleActor(actorIndex, [1.1, 1.1, 1.1])
        #
        #
        # if event.key() == Qt.Key.Key_Q:
        #     actorIndex = CabbageEngine.createActor("ArtistsAsset\\full_assets\\ElephantWithMonochord\\SoC-ElephantWithMonochord.usd", "static")
        #     actorIndex -= 1
        #     logger.info("test="+str(actorIndex))
        #     self.actorList.append(actorIndex)
        #    # CabbageEngine.moveActor(actorIndex, [random.random()*3.0-1.5, random.random()*3.0-1.5, random.random()*3.0-1.5])
        #  #   CabbageEngine.rotateActor(actorIndex, random.random()*3.14, [0.0, 1.0, 0.0])
        #  #   CabbageEngine.scaleActor(actorIndex, [0.1, 0.1, 0.1])
        #     print("Add Actor:"+ str(actorIndex))
        #     print('111')
        #     print('222')
        #
        # if event.key() == Qt.Key.Key_E:
        #     if self.actorList:
        #         actorIndex = self.actorList[-1]
        #         CabbageEngine.destoryActor(actorIndex)
        #         self.actorList.pop()
        #         print("Remove Actor:"+ str(actorIndex))
        #         print("Remove Actor")

        if event.key() == Qt.Key.Key_G:
            page_collection.show_ui("test_ui")
            pass

        if event.key() == Qt.Key.Key_F:
            page_collection.show_ui("inside_main")
            pass





