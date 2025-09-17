from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QPixmap, QScreen, QGuiApplication, QPainter
from PyQt5.QtWidgets import QApplication, QWidget, QMainWindow, QVBoxLayout, QLabel, QFrame, QStackedWidget, \
    QStyleOption, QDialog
import sys
import warnings
warnings.filterwarnings("ignore")


from PyQt5.uic.properties import QtCore
from exit import Ui_Dialog
from inside_menu import Ui_Form

class MyForm(QWidget, Ui_Form):

    def __init__(self):
        super().__init__()
        self.setupUi(self)

        # 关联按钮事件
        self.K1.clicked.connect(self.bt17_clicked)  # 物品按钮点击事件
        self.K2.clicked.connect(self.bt18_clicked)  # 线索按钮点击事件
        self.K3.clicked.connect(self.bt19_clicked)  # 任务按钮点击事件
        self.K4.clicked.connect(self.bt20_clicked)  # 设置按钮点击事件
        self.K5.clicked.connect(self.bt21_clicked)  # 离开游戏按钮点击事件
        self.page2_button[f"bt{1}"].clicked.connect(self.bt25_clicked)  # 线索标题1按钮点击事件



    def bt17_clicked(self):
        self.form_stacked.setCurrentIndex(0)

    def bt18_clicked(self):
        self.form_stacked.setCurrentIndex(1)

    def bt19_clicked(self):
        self.form_stacked.setCurrentIndex(2)

    def bt20_clicked(self):
        self.form_stacked.setCurrentIndex(3)

    def bt21_clicked(self):
        self.show_exit()

    def bt25_clicked(self):
        print("111")

    def show_exit(self):   #离开界面
        try:
            self.Exit_window = Exit()
            self.Exit_window.show()

            result = self.Exit_window.exec()

            if result == 1:
                # 用户点击了确定按钮
                QApplication.quit()
            else:
                self.Exit_window.close()

        except Exception as e:
            print(f"An error occurred: {type(e).__name__}, {str(e)}")



class Exit(QDialog, Ui_Dialog):
    def __init__(self):
        super().__init__()
        self.setupUi(self)
        self.bt_cancel.clicked.connect(self.reject)
        self.bt_confirm.clicked.connect(self.accept)

if __name__ == '__main__':
    app = QApplication(sys.argv)
    inside_menu = MyForm()
    inside_menu.setWindowTitle('inside_menu')
    inside_menu.show()
    sys.exit(app.exec())






