from Models.BaseEnum import *

def auto_property(attrs_dict: dict, type=VariableType.StaticVariable):
    """类装饰器工厂函数
    :param type: StaticVariavle | DynamicVaribale
    :param attrs: 需要自动生成property的属性名列表
    :param log: 是否启用访问日志
    :param type_check: 是否启用类型检查
    """

    def deault_value(default_type):
        if default_type == str:
            return ""
        elif default_type == int:
            return 0
        elif default_type == float:
            return 0.0
        elif default_type == list:
            return []
        elif default_type == tuple:
            return ()
        elif default_type == dict:
            return {}
        else:
            return 0

    def decorator(cls):
        for attr, attr_type in attrs_dict.items():
            # 创建私有属性存储字段名
            private_attr = f"_{attr}"
            defalut = deault_value(attr_type)
            setattr(cls, private_attr, defalut)

            # 动态生成getter函数
            def getter(self, private_attr=private_attr):
                return getattr(self, private_attr)

            # 动态生成setter函数
            def setter(self, value, private_attr=private_attr):
                setattr(self, private_attr, value)

            # 创建property对象并绑定到类
            prop = property(getter)
            prop = prop.setter(setter)
            setattr(cls, attr, prop)
            if type == VariableType.StaticVariable:
                cls.static_variable_list.append(attr)
            else:
                cls.dynamic_variable_list.append(attr)
                setattr(cls, f"{attr}_ogn", defalut)

        return cls

    return decorator


@auto_property({"id": int, "name": str, 'desc': str, 'text': str}, type=VariableType.StaticVariable)
class BaseActor:
    static_variable_list = []
    dynamic_variable_list = []

    def memory_dynamic_variable(self):
        """
        记录动态成员参数
        :return:
        """
        for dyn_attr in self.dynamic_variable_list:
            setattr(self, f"{dyn_attr}_ogn", getattr(self, dyn_attr))

    def rollback_dynamic_variable(self):
        """
        回滚动态成员参数
        :return:
        """
        for dyn_attr in self.dynamic_variable_list:
            setattr(self, dyn_attr, getattr(self, f"{dyn_attr}_ogn"))

    def init_varibale(self, attr_dict):
        """
        初始化成员变量
        :param attr_dict:
        :return:
        """
        for attr in attr_dict:
            setattr(self, attr, attr_dict[attr])
