import logging

from PyQt5 import QtWidgets

from UI.MainLogic.InsidePage.main.inside_ui import InsideWindow
from UI.UI_collection import page_collection

from UI.UI_main import Window
from UI.test_video import OutsideWindow

import sys



try:
    app = QtWidgets.QApplication(sys.argv)
    ex = Window()
    page_collection.add_ui("main", ex)
    page_collection.get_ui("main").show()

    outside_ui = OutsideWindow()
    page_collection.add_ui("test_ui", outside_ui)
    ex.layout.addWidget(outside_ui)

    inside_main = InsideWindow()
    page_collection.add_ui("inside_main", inside_main)
    ex.layout.addWidget(inside_main)
except Exception as e:
    logging.error(e)

app.exec()