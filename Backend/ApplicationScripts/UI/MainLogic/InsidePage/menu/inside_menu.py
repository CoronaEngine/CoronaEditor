import os.path

from PyQt5 import QtCore, QtGui, QtWidgets
from PyQt5.QtCore import QObject, Qt
from PyQt5.QtGui import QPixmap, QIcon
from PyQt5.QtWidgets import QFrame, QWidget
from Tools.settings import ui_source_path

class Ui_Form(object):
        def setupUi(self, Form):


                Form.setObjectName("Form")
                Form.resize(1098, 687)
                Form.setStyleSheet("*{ \n"
        "    color: white ;\n"
        "    font-size:20px;\n"
        "    background-color: rgb(48, 48, 48);\n"
        "    font-weight: bold;\n"
        "    margin:0px\n"
        "    \n"
        "}\n"
        "QLabel[myclass=lb1]{\n"
        "    border-bottom: 2px solid rgb(255, 255, 255);\n"
        "\n"
        "    \n"
        "}\n"
        "QLabel[myclass=lb2]{\n"
        "    border-bottom: 2px solid rgb(255, 255, 255);\n"
        "    min-height:38px;\n"
        "    \n"
        "}\n"
        "QPushButton[myclass=bt1]:hover {\n"
        "    background-color: white;  \n"
        "    color: black;             \n"
        "}\n"
        "\n"
        "QPushButton[myclass=bt1] {\n"
        "    border-top: none; \n"
        "    border-bottom: 2px solid white; \n"
        "    border-left:none; \n"
        "    border-right:none; \n"
        "    height:38px;\n"
        "\n"
        "}\n"
        "QFrame#frame_2{\n"
        "    border-top: none; \n"
        "    border-bottom: none;\n"
        "    border-left:2px solid white;\n"
        "    border-right:none;\n"
        "}\n"
        "\n"
        "QPushButton[myclass=bt2]:hover {\n"
        "    \n"
        "    background-color: rgb(85, 0, 0);\n"
        "               \n"
        "}\n"
        "QPushButton[myclass=bt2] {\n"
        "    \n"
        "    height:35px;\n"
        "\n"
        "}\n"
        "\n"
        "QFrame#page2_frame1,#page4_frame1{\n"
        "    border-top: none; \n"
        "    border-bottom: none;\n"
        "    border-left:none;\n"
        "    border-right:2px solid white;\n"
        "}\n"
        "\n"
        "QPushButton[myclass=bt3] {\n"
        "    background-color: rgb(88, 88, 88);\n"
        "    border-top: none; \n"
        "    border-bottom: 2px solid white;\n"
        "    border-left:none;\n"
        "    border-right:none;\n"
        "    height:35px;\n"
        "}\n"
"\n"
"\n"
"\n"
"\n"
"\n"
"\n"
"\n"
"")
                self.form_horLay = QtWidgets.QHBoxLayout(Form)#最上层Form
                self.form_horLay.setContentsMargins(0, 0, 0, 0)
                self.form_horLay.setSpacing(0)
                self.form_horLay.setObjectName("widget_horLay")

                self.form_stacked= QtWidgets.QStackedWidget(Form)#最上层Form的stacked
                self.form_stacked.setLineWidth(0)
                self.form_stacked.setObjectName("form_stacked")
        #page
                self.page = QtWidgets.QWidget()#form_stacked的第一页
                self.page.setObjectName("page")
                self.form_stacked.addWidget(self.page)

                self.page_verLay = QtWidgets.QVBoxLayout(self.page)#page的布局
                self.page_verLay.setContentsMargins(0, 0, 0, 0)
                self.page_verLay.setSpacing(0)
                self.page_verLay.setObjectName("page_verLay")
                self.page_verLay.setStretch(0, 1)
                self.page_verLay.setStretch(1, 16)

                self.page_toplb = QtWidgets.QLabel(self.page)#page内最上面的label(title)
                self.page_toplb.setFrameShape(QtWidgets.QFrame.Shape.NoFrame)
                self.page_toplb.setAlignment(QtCore.Qt.AlignmentFlag.AlignLeading|QtCore.Qt.AlignmentFlag.AlignLeft|QtCore.Qt.AlignmentFlag.AlignVCenter)
                self.page_toplb.setObjectName("page_toplb")
                self.page_verLay.addWidget(self.page_toplb)

                self.page_frame = QtWidgets.QFrame(self.page)#page内的frame
                self.page_frame.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
                self.page_frame.setFrameShadow(QtWidgets.QFrame.Shadow.Raised)
                self.page_frame.setObjectName("page_frame")
                self.page_verLay.addWidget(self.page_frame)

                self.page_frame_verLay = QtWidgets.QVBoxLayout(self.page_frame)#page内的frame的布局
                self.page_frame_verLay.setContentsMargins(14, 15, 0, 0)
                self.page_frame_verLay.setSpacing(0)
                self.page_frame_verLay.setObjectName("page_frame_verLay")

                self.page_frame_verLay2 = QtWidgets.QVBoxLayout()#page内的frame中的verLay
                self.page_frame_verLay2.setObjectName("page_frame_verLay2")
                self.page_frame_verLay.addLayout(self.page_frame_verLay2)
                self.page_frame_verLay2_griLay= QtWidgets.QGridLayout()#page_frame_verLay2中的griLay
                self.page_frame_verLay2_griLay.setObjectName("page_frame_verLay2_griLay")
                self.page_frame_verLay2.addLayout(self.page_frame_verLay2_griLay)

                page_spacerItem = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding, QtWidgets.QSizePolicy.Policy.Minimum)
                self.page_frame_verLay2_griLay.addItem(page_spacerItem, 1, 5, 1, 1)
                #加在page_frame_verLay2_griLay中的spacer
                page_spacerItem2 = QtWidgets.QSpacerItem(20, 408, QtWidgets.QSizePolicy.Policy.Minimum, QtWidgets.QSizePolicy.Policy.Expanding)
                self.page_frame_verLay.addItem(page_spacerItem2)#加在frame中的spacer

                self.page_button={}#page中的重复按钮
                for i in range(1,6):
                       self.page_button[f"bt{i}"]=QtWidgets.QPushButton(self.page_frame)
                       sizePolicy = QtWidgets.QSizePolicy(QtWidgets.QSizePolicy.Policy.Fixed,
                                                           QtWidgets.QSizePolicy.Policy.Fixed)
                       sizePolicy.setHorizontalStretch(0)
                       sizePolicy.setVerticalStretch(0)
                       sizePolicy.setHeightForWidth(self.page_button[f"bt{i}"].sizePolicy().hasHeightForWidth())
                       self.page_button[f"bt{i}"].setSizePolicy(sizePolicy)
                       self.page_button[f"bt{i}"].setStyleSheet("QPushButton {\n"
                                                     "    font-size: 15px;\n"
                                                     "    font-weight: normal;\n"
                                                     "    border: 0.5px solid rgb(255, 255, 255);\n" 
                                                     "      margin:0px 20px 0px 0px;"           
                                                     "}")
                       self.page_frame_verLay2_griLay.addWidget(self.page_button[f"bt{i}"], 0, i-1, 1, 1)
                       self.page_button[f"bt{i}"].setObjectName(f"page_bt{i}")

                self.page_label = {}#page中的重复label
                for j in range(1,6):
                        self.page_label[f"label{j}"] = QtWidgets.QLabel(self.page_frame)
                        self.page_label[f"label{j}"].setStyleSheet("QLabel {\n"
                        "    font-size: 15px;\n"
                        "    font-weight: normal;\n"
                        "}")
                        self.page_label[f"label{j}"].setObjectName(f"page_lb{j}")
                        self.page_frame_verLay2_griLay.addWidget(self.page_label[f"label{j}"], 1, j-1, 1, 1)

        #page2
                self.page2 = QtWidgets.QWidget()
                self.page2.setObjectName("page2")

                self.page2_verLay = QtWidgets.QVBoxLayout(self.page2)#page2的布局
                self.page2_verLay.setContentsMargins(0, 0, 0, 0)
                self.page2_verLay.setSpacing(0)
                self.page2_verLay.setObjectName("page2_verLay")

                self.page2_toplb = QtWidgets.QLabel(self.page2)#page2的title
                self.page2_toplb.setObjectName("page2_toplb")
                self.page2_verLay.addWidget(self.page2_toplb)

                self.page2_horLay = QtWidgets.QHBoxLayout()#page2底下的垂直布局
                self.page2_horLay.setObjectName("page2_horLay")

                self.page2_horLay_stackWid = QtWidgets.QStackedWidget(self.page2)#page2_horLay底下的stack
                self.page2_horLay_stackWid.setObjectName("page2_horLay_stackWid")

                self.page2_horLay_stackWid_1 = QtWidgets.QWidget()#page2_horLay_stackWid中的第一页
                self.page2_horLay_stackWid_1.setObjectName("page2_horLay_stackWid_1")

                self.page2_Wid_1 = QtWidgets.QHBoxLayout(self.page2_horLay_stackWid_1)#page2_horLay_stackWid中的第一页的布局
                self.page2_Wid_1.setContentsMargins(0, 0, 0, 0)
                self.page2_Wid_1.setSpacing(0)
                self.page2_Wid_1.setObjectName("page2_Wid_1")

                self.page2_frame1 = QtWidgets.QFrame(self.page2_horLay_stackWid_1)#page2_horLay_stackWid_1中的frame
                self.page2_frame1.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
                self.page2_frame1.setFrameShadow(QtWidgets.QFrame.Shadow.Raised)
                self.page2_frame1.setObjectName("page2_frame1")

                self.page2_f1_ver = QtWidgets.QVBoxLayout(self.page2_frame1)#page2_frame1的布局
                self.page2_f1_ver .setContentsMargins(0, 9, 0, 0)
                self.page2_f1_ver .setSpacing(0)
                self.page2_f1_ver .setObjectName("page2_f1_ver")

                self.page2_f1_ver2 = QtWidgets.QVBoxLayout()#page2_frame1底下的布局
                self.page2_f1_ver2.setObjectName("page2_f1_ver2")

                self.page2_button={}#page2中的重复按钮
                for i in range(1,4):
                        self.page2_button[f"bt{i}"] = QtWidgets.QPushButton(self.page2_frame1)
                        # self.page2_button[f"bt{i}"].setStyleSheet("QPushButton{\n"
                        #                                  "    font-size: 18px;\n"
                        #                                  "    font-weight: normal;\n""}")
                        self.page2_button[f"bt{i}"].setObjectName(f"page2_bt{i}")
                        self.page2_f1_ver2.addWidget(self.page2_button[f"bt{i}"])

                spacerItem2 = QtWidgets.QSpacerItem(20, 40, QtWidgets.QSizePolicy.Policy.Minimum, QtWidgets.QSizePolicy.Policy.Expanding)
                self.page2_f1_ver2.addItem(spacerItem2)
                self.page2_f1_ver2.setStretch(0, 1)
                self.page2_f1_ver2.setStretch(1, 1)
                self.page2_f1_ver2.setStretch(2, 1)
                self.page2_f1_ver.addLayout(self.page2_f1_ver2)
                self.page2_Wid_1.addWidget(self.page2_frame1)


                self.page2_frame2 = QtWidgets.QFrame(self.page2_horLay_stackWid_1)##page2_horLay_stackWid_1中的第二个frame
                self.page2_frame2.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
                self.page2_frame2.setFrameShadow(QtWidgets.QFrame.Shadow.Raised)
                self.page2_frame2.setObjectName("page2_frame2")

                self.page2_f2_ver = QtWidgets.QVBoxLayout(self.page2_frame2 )#page2_frame2的布局
                self.page2_f2_ver.setContentsMargins(0, 0, 0, 0)
                self.page2_f2_ver.setSpacing(0)
                self.page2_f2_ver.setObjectName("page2_f2_ver")

                self.page2_f2_hor= QtWidgets.QHBoxLayout()#page2_f2底下的hor
                self.page2_f2_hor.setObjectName("page2_f2_hor")

                spacerItem3 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding, QtWidgets.QSizePolicy.Policy.Minimum)
                self.page2_f2_hor.addItem(spacerItem3)

                self.page2_ph = QtWidgets.QLabel(self.page2_frame2 )#图片
                self.page2_ph.setText("")

                img_1=os.path.join(ui_source_path,"imgs","commom.jpg")
                self.page2_ph.setPixmap(QtGui.QPixmap(img_1))

                self.page2_ph.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
                self.page2_ph.setObjectName("page2_ph")
                self.page2_f2_hor.addWidget(self.page2_ph)

                spacerItem4 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding, QtWidgets.QSizePolicy.Policy.Minimum)
                self.page2_f2_hor.addItem(spacerItem4)
                self.page2_f2_hor.setStretch(0, 2)
                self.page2_f2_hor.setStretch(2, 2)
                self.page2_f2_ver.addLayout(self.page2_f2_hor)

                self.page2_plainText = QtWidgets.QPlainTextEdit(self.page2_frame2)#多行文本框
                self.page2_plainText.setStyleSheet("QPlainTextEdit {\n"
        "    font-size: 18px;\n"
        "    font-weight: normal;\n"
        "}")
                self.page2_plainText.setObjectName("page2_plainText")
                self.page2_f2_ver.addWidget(self.page2_plainText)

                self.page2_f2_ver.setStretch(0, 1)
                self.page2_f2_ver.setStretch(1, 1)
                self.page2_Wid_1.addWidget(self.page2_frame2)
                self.page2_horLay_stackWid.addWidget(self.page2_horLay_stackWid_1)

                self.page2_Wid_2 = QtWidgets.QWidget()#page2第二个页面
                self.page2_Wid_2.setObjectName("page2_Wid_2")
                self.page2_horLay_stackWid.addWidget(self.page2_Wid_2)
                self.page2_Wid_3 = QtWidgets.QWidget()#page2第三个页面
                self.page2_Wid_3.setObjectName("page2_Wid_3")
                self.page2_horLay_stackWid.addWidget(self.page2_Wid_3)
                self.page2_horLay.addWidget(self.page2_horLay_stackWid)
                self.page2_verLay.addLayout(self.page2_horLay)
                self.page2_verLay.setStretch(0, 1)
                self.page2_verLay.setStretch(1, 16)

                self.form_stacked.addWidget(self.page2)#添加page2到form_stacked

        # page4
                self.page4 = QtWidgets.QWidget()
                self.page4.setObjectName("page4")

                self.page4_verLay = QtWidgets.QVBoxLayout(self.page4)  # page4的布局
                self.page4_verLay.setContentsMargins(0, 0, 0, 0)
                self.page4_verLay.setSpacing(0)
                self.page4_verLay.setObjectName("page4_verLay")

                self.page4_toplb = QtWidgets.QLabel(self.page4)  # page4的title
                self.page4_toplb.setObjectName("page4_toplb")
                self.page4_verLay.addWidget(self.page4_toplb)

                self.page4_horLay = QtWidgets.QHBoxLayout()  # page4底下的垂直布局
                self.page4_horLay.setObjectName("page4_horLay")

                self.page4_horLay_stackWid = QtWidgets.QStackedWidget(self.page4)  # page4_horLay底下的stack
                self.page4_horLay_stackWid.setObjectName("page4_horLay_stackWid")

                self.page4_horLay_stackWid_1 = QtWidgets.QWidget()  # page4_horLay_stackWid中的第一页
                self.page4_horLay_stackWid_1.setObjectName("page4_horLay_stackWid_1")

                self.page4_Wid_1 = QtWidgets.QHBoxLayout(self.page4_horLay_stackWid_1)  # page4_horLay_stackWid中的第一页的布局
                self.page4_Wid_1.setContentsMargins(0, 0, 0, 0)
                self.page4_Wid_1.setSpacing(0)
                self.page4_Wid_1.setObjectName("page4_Wid_1")

                self.page4_frame1 = QtWidgets.QFrame(self.page4_horLay_stackWid_1)  # page4_horLay_stackWid_1中的frame
                self.page4_frame1.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
                self.page4_frame1.setFrameShadow(QtWidgets.QFrame.Shadow.Raised)
                self.page4_frame1.setObjectName("page4_frame1")

                self.page4_f1_ver = QtWidgets.QVBoxLayout(self.page4_frame1)  # page4_frame1的布局
                self.page4_f1_ver.setContentsMargins(0, 9, 0, 0)
                self.page4_f1_ver.setSpacing(0)
                self.page4_f1_ver.setObjectName("page4_f1_ver")

                self.page4_f1_ver2 = QtWidgets.QVBoxLayout()  # page4_frame1底下的布局
                self.page4_f1_ver2.setObjectName("page4_f1_ver2")

                self.page4_button = {}  # page4中的重复按钮
                for i in range(1, 3):
                        self.page4_button[f"bt{i}"] = QtWidgets.QPushButton(self.page4_frame1)
                        # self.page4_button[f"bt{i}"].setStyleSheet("QPushButton{\n"
                        #                                           "    font-size: 18px;\n"
                        #                                           "    font-weight: normal;\n""}")
                        self.page4_button[f"bt{i}"].setObjectName(f"page4_bt{i}")
                        self.page4_f1_ver2.addWidget(self.page4_button[f"bt{i}"])

                spacerItem2 = QtWidgets.QSpacerItem(20, 40, QtWidgets.QSizePolicy.Policy.Minimum,
                                                    QtWidgets.QSizePolicy.Policy.Expanding)
                self.page4_f1_ver2.addItem(spacerItem2)
                self.page4_f1_ver2.setStretch(0, 1)
                self.page4_f1_ver2.setStretch(1, 1)
                self.page4_f1_ver2.setStretch(2, 1)
                self.page4_f1_ver.addLayout(self.page4_f1_ver2)
                self.page4_Wid_1.addWidget(self.page4_frame1)

                self.page4_frame2 = QtWidgets.QFrame(self.page4_horLay_stackWid_1)  ##page4_horLay_stackWid_1中的第二个frame
                self.page4_frame2.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
                self.page4_frame2.setFrameShadow(QtWidgets.QFrame.Shadow.Raised)
                self.page4_frame2.setObjectName("page4_frame2")

                self.page4_f2_ver = QtWidgets.QVBoxLayout(self.page4_frame2)  # page4_frame2的布局
                self.page4_f2_ver.setContentsMargins(0, 0, 0, 0)
                self.page4_f2_ver.setSpacing(0)
                self.page4_f2_ver.setObjectName("page4_f2_ver")

                self.page4_f2_hor = QtWidgets.QHBoxLayout()  # page4_f2底下的hor
                self.page4_f2_hor.setObjectName("page4_f2_hor")

                spacerItem3 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding,
                                                    QtWidgets.QSizePolicy.Policy.Minimum)
                self.page4_f2_hor.addItem(spacerItem3)

                self.page4_ph = QtWidgets.QLabel(self.page4_frame2)  # 图片
                self.page4_ph.setText("")


                self.page4_ph.setPixmap(QtGui.QPixmap(img_1))
                self.page4_ph.setAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)
                self.page4_ph.setObjectName("page4_ph")
                self.page4_f2_hor.addWidget(self.page4_ph)

                spacerItem4 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding,
                                                    QtWidgets.QSizePolicy.Policy.Minimum)
                self.page4_f2_hor.addItem(spacerItem4)
                self.page4_f2_hor.setStretch(0, 2)
                self.page4_f2_hor.setStretch(2, 2)
                self.page4_f2_ver.addLayout(self.page4_f2_hor)

                self.page4_plainText = QtWidgets.QPlainTextEdit(self.page4_frame2)  # 多行文本框
                self.page4_plainText.setStyleSheet("QPlainTextEdit {\n"
                                                   "    font-size: 18px;\n"
                                                   "    font-weight: normal;\n"
                                                   "}")
                self.page4_plainText.setObjectName("page4_plainText")
                self.page4_f2_ver.addWidget(self.page4_plainText)

                self.page4_f2_ver.setStretch(0, 1)
                self.page4_f2_ver.setStretch(1, 1)
                self.page4_Wid_1.addWidget(self.page4_frame2)
                self.page4_horLay_stackWid.addWidget(self.page4_horLay_stackWid_1)

                self.page4_Wid_2 = QtWidgets.QWidget()  # page4第二个页面
                self.page4_Wid_2.setObjectName("page4_Wid_2")
                self.page4_horLay_stackWid.addWidget(self.page4_Wid_2)
                self.page4_Wid_3 = QtWidgets.QWidget()  # page4第三个页面
                self.page4_Wid_3.setObjectName("page4_Wid_3")
                self.page4_horLay_stackWid.addWidget(self.page4_Wid_2)
                self.page4_horLay.addWidget(self.page4_horLay_stackWid)
                self.page4_verLay.addLayout(self.page4_horLay)
                self.page4_verLay.setStretch(0, 1)
                self.page4_verLay.setStretch(1, 16)

                self.form_stacked.addWidget(self.page4)  # 添加page4到form_stacked

        # page3
                self.page3 = QtWidgets.QWidget()
                self.page3.setObjectName("page3")
                self.page3_verLay= QtWidgets.QVBoxLayout(self.page3)
                self.page3_verLay.setContentsMargins(0, 0, 0, 0)
                self.page3_verLay.setSpacing(0)
                self.page3_verLay.setObjectName("page3_verLay")
                self.form_stacked.addWidget(self.page3)

                self.form_horLay.addWidget(self.form_stacked)#将stackwidget添加到Form

        # Form下的frame_2



                self.frame_2 = QtWidgets.QFrame(Form)
                self.frame_2.setFrameShape(QtWidgets.QFrame.Shape.StyledPanel)
                self.frame_2.setFrameShadow(QtWidgets.QFrame.Shadow.Raised)
                self.frame_2.setObjectName("frame_2")
                self.verticalLayout = QtWidgets.QVBoxLayout(self.frame_2)
                self.verticalLayout.setObjectName("verticalLayout")

                self.frame_horLay1 = QtWidgets.QHBoxLayout()
                self.frame_horLay1.setObjectName("frame_horLay1")
                spacerItem9 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding,
                                                    QtWidgets.QSizePolicy.Policy.Minimum)
                self.frame_horLay1.addItem(spacerItem9)
                self.K1 = QtWidgets.QPushButton(self.frame_2)

                self.K1.setObjectName("K1")
                self.frame_horLay1.addWidget(self.K1)
                self.verticalLayout.addLayout(self.frame_horLay1)
                self.frame_horLay3 = QtWidgets.QHBoxLayout()
                self.frame_horLay3.setObjectName("frame_horLay3")
                spacerItem10 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding,
                                                     QtWidgets.QSizePolicy.Policy.Minimum)
                self.frame_horLay3.addItem(spacerItem10)
                self.K3 = QtWidgets.QPushButton(self.frame_2)

                self.K3.setObjectName("K3")
                self.frame_horLay3.addWidget(self.K3)
                spacerItem11 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding,
                                                     QtWidgets.QSizePolicy.Policy.Minimum)
                self.frame_horLay3.addItem(spacerItem11)
                self.verticalLayout.addLayout(self.frame_horLay3)
                self.frame_horLay2 = QtWidgets.QHBoxLayout()
                self.frame_horLay2.setObjectName("frame_horLay2")
                self.K2 = QtWidgets.QPushButton(self.frame_2)

                self.K2.setObjectName("K2")
                self.frame_horLay2.addWidget(self.K2)
                spacerItem12 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding,
                                                     QtWidgets.QSizePolicy.Policy.Minimum)
                self.frame_horLay2.addItem(spacerItem12)
                self.verticalLayout.addLayout(self.frame_horLay2)
                self.frame_horLay4 = QtWidgets.QHBoxLayout()
                self.frame_horLay4.setObjectName("frame_horLay4")
                spacerItem13 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding,
                                                     QtWidgets.QSizePolicy.Policy.Minimum)
                self.frame_horLay4.addItem(spacerItem13)
                self.K4 = QtWidgets.QPushButton(self.frame_2)

                self.K4.setObjectName("K4")
                self.frame_horLay4.addWidget(self.K4)
                spacerItem14 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding,
                                                     QtWidgets.QSizePolicy.Policy.Minimum)
                self.frame_horLay4.addItem(spacerItem14)
                self.verticalLayout.addLayout(self.frame_horLay4)
                self.Lay5_spa5 = QtWidgets.QHBoxLayout()
                self.Lay5_spa5.setObjectName("Lay5_spa5")
                spacerItem15 = QtWidgets.QSpacerItem(40, 20, QtWidgets.QSizePolicy.Policy.Expanding,
                                                     QtWidgets.QSizePolicy.Policy.Minimum)
                self.Lay5_spa5.addItem(spacerItem15)
                self.K5 = QtWidgets.QPushButton(self.frame_2)

                self.K5.setObjectName("K5")
                self.Lay5_spa5.addWidget(self.K5)
                self.verticalLayout.addLayout(self.Lay5_spa5)

                self.verticalLayout.setStretch(0, 1)
                self.verticalLayout.setStretch(1, 1)
                self.verticalLayout.setStretch(2, 1)
                self.verticalLayout.setStretch(3, 1)
                self.verticalLayout.setStretch(4, 1)

                self.form_horLay.addWidget(self.frame_2)
                self.form_horLay.setStretch(0, 5)
                self.form_horLay.setStretch(1, 1)

                self.retranslateUi(Form)
                self.form_stacked.setCurrentIndex(0)
                QtCore.QMetaObject.connectSlotsByName(Form)


        def retranslateUi(self, Form):
                _translate = QtCore.QCoreApplication.translate
                Form.setWindowTitle(_translate("Form", "Form"))
                # 创建图片对象
                img_2 = os.path.join(ui_source_path, "imgs","key.jpg")
                pixmap2 = QPixmap(img_2)  # 替换为图片路径
                img_3= os.path.join(ui_source_path, "imgs", "clue button.jpg")
                pixmap3 = QPixmap(img_3)
                img_4 = os.path.join(ui_source_path, "imgs", "return button.jpg")
                pixmap4 = QPixmap(img_4)
                img_5 = os.path.join(ui_source_path, "imgs", "set button.jpg")
                pixmap5 = QPixmap(img_5)
                img_6 = os.path.join(ui_source_path, "imgs", "things button.jpg")
                pixmap6 = QPixmap(img_6)
                img_7 = os.path.join(ui_source_path, "imgs", "task button.jpg")
                pixmap7 = QPixmap(img_7)

                # 将图片设置为按钮的图标
                icon2 = QIcon(pixmap2)
                icon3 = QIcon(pixmap3)
                icon4 = QIcon(pixmap4)
                icon5= QIcon(pixmap5)
                icon6 = QIcon(pixmap6)
                icon7 = QIcon(pixmap7)

                self.page_toplb.setText(_translate("Form", "所持物品"))
                self.page_toplb.setProperty("myclass", _translate("Form", "lb2"))

                for i in range(1,6):
                       self.page_label[f"label{i}"].setText(_translate("Form", f"钥匙{i}"))
                       self.page_button[f"bt{i}"].setIconSize(pixmap2.size())
                       self.page_button[f"bt{i}"].setIcon(icon2)


                self.page2_toplb.setText(_translate("Form", "持有线索"))
                self.page2_toplb.setProperty("myclass", _translate("Form", "lb1"))

                for i in range(1,4):
                        self.page2_button[f"bt{i}"].setProperty("myclass", _translate("Form", "bt2"))
                        self.page2_button[f"bt{i}"].setText(_translate("Form", f"线索标题{i}"))


                self.page2_plainText.setPlainText(
                        _translate("Form", "线索内容线索内容线索内容线索内容线索内容线索内容线索内容线索内容线索内容线索内容线索内容线索内容线索内容线索内容线索内容"))

                self.page4_toplb.setText(_translate("Form", "当前任务"))
                self.page4_toplb.setProperty("myclass", _translate("Form", "lb1"))
                for i in range(1,3):
                        self.page4_button[f"bt{i}"].setText(_translate("Form", f"打开大门{i}"))
                        self.page4_button[f"bt{i}"].setProperty("myclass", _translate("Form", "bt3"))

                self.page4_plainText.setPlainText(_translate("Form", "找到打开大门的钥匙"))

                self.K1.setIconSize(pixmap6.size())
                self.K1.setIcon(icon6)
                self.K2.setIconSize(pixmap3.size())
                self.K2.setIcon(icon3)
                self.K3.setIconSize(pixmap7.size())
                self.K3.setIcon(icon7)
                self.K4.setIconSize(pixmap5.size())
                self.K4.setIcon(icon5)
                self.K5.setIconSize(pixmap4.size())
                self.K5.setIcon(icon4)





















