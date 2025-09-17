
import sys
from types import ModuleType

__all__ = []




from Models.BaseActor import *
from Models.BaseEnum import *
from Tools.loggings import logger
from Tools.settings import *
from Tools.read_excel import *
from Tools.save_and_load import *
from Tools.game_setting import *
from Pools.game_pool import *
from Pools.resource_pool import *





def _auto_detect_exports():
    """自动检测需要导出的符号"""
    current_module = sys.modules[__name__]

    # 需要排除的默认内置属性
    exclude = {
        '__name__', '__doc__', '__package__', '__loader__', '__spec__',
        '__file__', '__builtins__', '__all__', '_auto_detect_exports'
    }

    # 自动收集所有非私有的导出项
    exports = [
        name for name in dir(current_module)
        if not name.startswith('_')
           and name not in exclude
           and not isinstance(getattr(current_module, name), ModuleType)
    ]

    # 更新 __all__ 列表
    current_module.__dict__.setdefault('__all__', []).extend(exports)
    current_module.__all__ = list(sorted(set(current_module.__all__)))


_auto_detect_exports()
del _auto_detect_exports  # 清理临时函数
