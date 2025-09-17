import logging
import os
import time
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
from Tools.settings import root_project_path

log_path = os.path.join(root_project_path,'Log','')

now_date = datetime.now().strftime("%Y-%m-%d")


logging.basicConfig(filename=f"{log_path}{now_date}.log",filemode="a", format="%(asctime)s %(filename)s:%(funcName)s:%(levelname)s:%(lineno)s:%(message)s", datefmt="%d-%M-%Y %H:%M:%S", level=logging.DEBUG)

logger = logging.getLogger()

