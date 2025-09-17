import importlib
import inspect
import os
import traceback
from pathlib import Path
from typing import Type

from Tools.loggings import logger
from Tools.read_excel import read_excel

from Models.BaseActor import BaseActor
from Tools.settings import table_path, model_path


class ResourcePool:
    """
    游戏资源池
    """
    actors_path = model_path
    excel_path = table_path

    def __init__(self, auto_import=False):
        self.pool_list = dict()
        self.actor_list = dict()
        if auto_import:
            self.import_classes_from_dir(model_path, BaseActor)

    def import_classes_from_dir(self, directory: str, base_class: Type = object, recursive: bool = True):
        """动态导入指定目录下所有Python文件中的类

        :param directory: 目标目录路径
        :param base_class: 仅导入继承自该基类的类（默认包含所有类）
        :param recursive: 是否递归搜索子目录
        :param exclude_files: 需要排除的文件列表
        :return: 类名字典 {类名: 类对象}
        """
        # 构建文件遍历路径
        search_path = Path(directory)
        if not search_path.exists():
            raise FileNotFoundError(f"目录不存在: {directory}")

        # 设置glob模式匹配
        pattern = "**/*.py" if recursive else "*.py"

        for py_file in search_path.glob(pattern):
            # 跳过排除文件和__init__.py
            if py_file.name == "__init__.py":
                continue

            # 动态导入模块
            module_name = py_file.stem
            spec = importlib.util.spec_from_file_location(module_name, str(py_file))
            if spec is None:
                continue  # 跳过非Python文件

            try:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
            except Exception as e:
                print(f"导入模块 {py_file} 失败: {str(e)}")
                continue

            # 遍历模块成员寻找符合条件的类
            for name, obj in inspect.getmembers(module):
                if inspect.isclass(obj) and issubclass(obj, base_class) and obj != base_class and obj.__module__ == module_name:
                    # 处理类名冲突
                    final_name = name
                    if name in self.actor_list:
                        continue
                    self.actor_list[final_name] = obj

                    if os.path.exists(os.path.join(table_path, f"{final_name}.xlsx")):
                        self.init_pool(obj, os.path.join(table_path, f"{final_name}.xlsx"))

    def init_pool(self, pool_class, excel_path=None, sheet_name=None):
        try:
            if pool_class.__name__ not in self.pool_list:
                self.pool_list[pool_class.__name__] = dict()
                if excel_path:
                    for each_actor in read_excel(excel_path, sheet_name):
                        actor = pool_class()
                        actor.init_varibale(each_actor)
                        self.pool_list[pool_class.__name__].update({each_actor.get('id'): actor})
            else:
                pass
        except Exception as e:
            logger.error(str(e))
            return "Error"

    def del_pool(self, pool_name):
        try:
            if pool_name in self.pool_list:
                self.pool_list.pop(pool_name)
            else:
                pass
        except Exception as e:
            logger.error(str(e))
            return "Error"

    def add_pool_actor(self, pool_name, index, pool_actor):
        try:
            if pool_name in self.pool_list:
                self.pool_list[pool_name][index] = pool_actor
            else:
                self.init_pool(pool_name)
                self.pool_list[pool_name][index] = pool_actor
        except Exception as e:
            logger.error(str(e))
            return "Error"

    def get_pool_actor(self, pool_name, index):
        try:
            if pool_name in self.pool_list and index in self.pool_list[pool_name]:
                return self.pool_list[pool_name][index]
            else:
                return "Error"
        except Exception as e:
            logger.error(str(e))
            return "Error"

    def del_pool_actor(self, pool_name, index):
        try:
            if pool_name in self.pool_list and index in self.pool_list[pool_name]:
                return self.pool_list[pool_name].pop(index)
            else:
                return "Error"
        except Exception as e:
            logger.error(str(e))
            return "Error"


if __name__ == '__main__':
    ResourcePool()
