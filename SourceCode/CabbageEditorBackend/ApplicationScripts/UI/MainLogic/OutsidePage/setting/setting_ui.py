from PyQt5 import QtCore, QtGui, QtWidgets
from PyQt5.QtCore import *
from PyQt5.QtWidgets import QWidget, QApplication, QGridLayout, QLabel
#from Tools.loggings import logger
import sys

class SettingWindow(QWidget):

    def setupUi(self, Form):
        Form.setObjectName("Form")
        Form.resize(700, 460)
        # Form.setStyleSheet("background-color:rgb(0, 0, 0); ")

        self.main_widget = QtWidgets.QWidget(parent=Form)
        self.main_widget.setGeometry(QtCore.QRect(50, 10, 600, 430))
        # self.main_widget.setStyleSheet("background-color:rgb(255, 0, 0); ")
        self.main_widget.setObjectName("main_widget")


        self.main_vertical_layout = QtWidgets.QVBoxLayout(self.main_widget)
        self.main_vertical_layout.setContentsMargins(0, 0, 0, 0)
        self.main_vertical_layout.setObjectName("main_vertical_layout")


        # 标题
        self.horizontalLayout_title = QtWidgets.QHBoxLayout()
        self.horizontalLayout_title.setSpacing(4)
        self.horizontalLayout_title.setObjectName("horizontalLayout_title")
        self.main_vertical_layout.addLayout(self.horizontalLayout_title)

        self.game_settings_text = QtWidgets.QLabel(parent=Form)
        self.game_settings_text.setGeometry(QtCore.QRect(240, 20, 100, 10))
        self.game_settings_text.setTextFormat(QtCore.Qt.TextFormat.AutoText)
        self.game_settings_text.setObjectName("game_settings_text")
        self.horizontalLayout_title.addWidget(self.game_settings_text)

        # 声音设置
        self.horizontalLayout_sound_title = QtWidgets.QHBoxLayout()
        self.horizontalLayout_sound_title.setSpacing(4)
        self.horizontalLayout_sound_title.setObjectName("horizontalLayout_sound_title")
        self.main_vertical_layout.addLayout(self.horizontalLayout_sound_title)
        
        self.audio_text = QtWidgets.QLabel(parent=self.main_widget)
        self.audio_text.setObjectName("audio_text")
        self.horizontalLayout_sound_title.addWidget(self.audio_text)

        # 总音量

        self.horizontalLayout_main_sound = QtWidgets.QHBoxLayout()
        self.horizontalLayout_main_sound.setSpacing(4)
        self.horizontalLayout_main_sound.setObjectName("horizontalLayout_main_sound")
        self.main_vertical_layout.addLayout(self.horizontalLayout_main_sound)

        self.volume_text = QtWidgets.QLabel(parent=self.main_widget)
        self.volume_text.setObjectName("volume_text")
        self.horizontalLayout_main_sound.addWidget(self.volume_text)

        self.volume_slider = QtWidgets.QScrollBar(parent=self.main_widget)
        self.volume_slider.setMaximumSize(QtCore.QSize(500, 16777215))
        self.volume_slider.setOrientation(QtCore.Qt.Orientation.Horizontal)
        self.volume_slider.setObjectName("volume_slider")
        self.volume_slider.valueChanged.connect(self.bar_value_changed)
        self.horizontalLayout_main_sound.addWidget(self.volume_slider)



        # 环境音量
        self.horizontalLayout_env_sound = QtWidgets.QHBoxLayout()
        self.horizontalLayout_env_sound.setSpacing(4)
        self.horizontalLayout_env_sound.setObjectName("horizontalLayout_env_sound")
        self.main_vertical_layout.addLayout(self.horizontalLayout_env_sound)

        self.SFXvolume_text = QtWidgets.QLabel(parent=self.main_widget)
        self.SFXvolume_text.setObjectName("SFXvolume_text")
        self.horizontalLayout_env_sound.addWidget(self.SFXvolume_text)

        self.SFXvolume_slider = QtWidgets.QScrollBar(parent=self.main_widget)
        self.SFXvolume_slider.setMaximumSize(QtCore.QSize(500, 16777215))
        self.SFXvolume_slider.setOrientation(QtCore.Qt.Orientation.Horizontal)
        self.SFXvolume_slider.setObjectName("SFXvolume_slider")
        self.SFXvolume_slider.valueChanged.connect(self.bar_value_changed)
        self.horizontalLayout_env_sound.addWidget(self.SFXvolume_slider)



        # 角色音量
        self.horizontalLayout_role_sound = QtWidgets.QHBoxLayout()
        self.horizontalLayout_role_sound.setSpacing(4)
        self.horizontalLayout_role_sound.setObjectName("horizontalLayout_role_sound")
        self.main_vertical_layout.addLayout(self.horizontalLayout_role_sound)

        self.dialogue_volume_text = QtWidgets.QLabel(parent=self.main_widget)
        self.dialogue_volume_text.setObjectName("dialogue_volume_text")
        self.horizontalLayout_role_sound.addWidget(self.dialogue_volume_text)

        self.dialogue_volume_slider = QtWidgets.QScrollBar(parent=self.main_widget)
        self.dialogue_volume_slider.setMaximumSize(QtCore.QSize(500, 16777215))
        self.dialogue_volume_slider.setOrientation(QtCore.Qt.Orientation.Horizontal)
        self.dialogue_volume_slider.setObjectName("dialogue_volume_slider")
        self.dialogue_volume_slider.valueChanged.connect(self.bar_value_changed)
        self.horizontalLayout_role_sound.addWidget(self.dialogue_volume_slider)



        # 画面设置
        self.horizontalLayout_scene_title = QtWidgets.QHBoxLayout()
        self.horizontalLayout_scene_title.setSpacing(4)
        self.horizontalLayout_scene_title.setObjectName("horizontalLayout_scene_title")
        self.main_vertical_layout.addLayout(self.horizontalLayout_scene_title)

        self.graphics_settings_text = QtWidgets.QLabel(parent=self.main_widget)
        self.graphics_settings_text.setObjectName("graphics_settings_text")
        self.horizontalLayout_scene_title.addWidget(self.graphics_settings_text)

        # 分辨率
        self.horizontalLayout_resolution = QtWidgets.QHBoxLayout()
        self.horizontalLayout_resolution.setSpacing(4)
        self.horizontalLayout_resolution.setObjectName("horizontalLayout_resolution")
        self.main_vertical_layout.addLayout(self.horizontalLayout_resolution)

        self.FPS_text = QtWidgets.QLabel(parent=self.main_widget)
        self.FPS_text.setObjectName("FPS_text")
        self.horizontalLayout_resolution.addWidget(self.FPS_text)


        self.FPS_box = QtWidgets.QComboBox(parent=self.main_widget)
        self.FPS_box.setObjectName("FPS_box")
        self.FPS_box.addItems(["480P","720P","1080P","2k","4k"])
        self.FPS_box.setEditable(True)
        self.FPS_box.lineEdit().setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.horizontalLayout_resolution.addWidget(self.FPS_box)


        # 画质

        self.horizontalLayout_image_quality = QtWidgets.QHBoxLayout()
        self.horizontalLayout_image_quality.setSpacing(4)
        self.horizontalLayout_image_quality.setObjectName("horizontalLayout_image_quality")
        self.main_vertical_layout.addLayout(self.horizontalLayout_image_quality)

        self.graphics_quality_text = QtWidgets.QLabel(parent=self.main_widget)
        self.graphics_quality_text.setObjectName("graphics_quality_text")
        self.horizontalLayout_image_quality.addWidget(self.graphics_quality_text)

        self.graphics_low = QtWidgets.QPushButton(parent=self.main_widget)
        self.graphics_low.setObjectName("graphics_low")
        self.horizontalLayout_image_quality.addWidget(self.graphics_low)
        self.graphics_medium = QtWidgets.QPushButton(parent=self.main_widget)
        self.graphics_medium.setObjectName("graphics_medium")
        self.horizontalLayout_image_quality.addWidget(self.graphics_medium)
        self.graphics_high = QtWidgets.QPushButton(parent=self.main_widget)
        self.graphics_high.setObjectName("graphics_high")
        self.horizontalLayout_image_quality.addWidget(self.graphics_high)

        # 画面亮度
        self.horizontalLayout_brightness = QtWidgets.QHBoxLayout()
        self.horizontalLayout_brightness.setSpacing(4)
        self.horizontalLayout_brightness.setObjectName("horizontalLayout_brightness")
        self.main_vertical_layout.addLayout(self.horizontalLayout_brightness)

        self.brightness_text = QtWidgets.QLabel(parent=self.main_widget)
        self.brightness_text.setObjectName("brightness_text")
        self.horizontalLayout_brightness.addWidget(self.brightness_text)

        self.brightness_slider = QtWidgets.QScrollBar(parent=self.main_widget)
        self.brightness_slider.setMaximumSize(QtCore.QSize(500, 16777215))
        self.brightness_slider.setOrientation(QtCore.Qt.Orientation.Horizontal)
        self.brightness_slider.setObjectName("brightness_slider")
        self.brightness_slider.valueChanged.connect(self.bar_value_changed)
        self.horizontalLayout_brightness.addWidget(self.brightness_slider)

        # 确认按钮
        self.horizontalLayout_ensure = QtWidgets.QHBoxLayout()
        self.horizontalLayout_ensure.setSpacing(4)
        self.horizontalLayout_ensure.setObjectName("horizontalLayout_ensure")
        self.main_vertical_layout.addLayout(self.horizontalLayout_ensure)
        


        self.default_button = QtWidgets.QPushButton(parent=self.main_widget)
        self.default_button.setObjectName("default_button")
        self.default_button.clicked.connect(self.button_onclick)
        self.horizontalLayout_ensure.addWidget(self.default_button)
        self.save_button = QtWidgets.QPushButton(parent=self.main_widget)
        self.save_button.setObjectName("save_button")
        self.save_button.clicked.connect(self.button_onclick)
        self.horizontalLayout_ensure.addWidget(self.save_button)

        self.retranslateUi(Form)
        QtCore.QMetaObject.connectSlotsByName(Form)

    def retranslateUi(self, Form):
        _translate = QtCore.QCoreApplication.translate
        Form.setWindowTitle(_translate("Form", "Setting"))
        self.game_settings_text.setText(_translate("Form","游戏设置"))
        self.audio_text.setText(_translate("Form","声音设置"))
        self.volume_text.setText(_translate("Form","总 音 量："))
        self.SFXvolume_text.setText(_translate("Form","环境音量："))
        self.dialogue_volume_text.setText(_translate("Form","角色音量："))
        self.graphics_settings_text.setText(_translate("Form","画面设置"))
        self.FPS_text.setText(_translate("Form","分 辨 率："))
        self.graphics_quality_text.setText(_translate("Form","画  质："))
        self.brightness_text.setText(_translate("Form","画面亮度："))
        self.graphics_low.setText(_translate("Form", "低"))
        self.graphics_medium.setText(_translate("Form", "中"))
        self.graphics_high.setText(_translate("Form", "高"))
        self.default_button.setText(_translate("Form", "还原默认"))
        self.save_button.setText(_translate("Form", "保存"))


    def button_onclick(self):
        sender = self.sender()
        print(f"{sender.objectName()} {sender.text()}")

    def bar_value_changed(self):
        sender = self.sender()
        print(f"{sender.objectName()} {sender.value()}")

if __name__ == '__main__':
    app = QtWidgets.QApplication(sys.argv)
    Window = QtWidgets.QMainWindow()
    ui = SettingWindow()
    ui.setupUi(Window)
    Window.show()
    sys.exit(app.exec())

