from Models.BaseImport import *


@auto_property(
    {"icon": list, 'effect_cfg': int, 'floating_text': str, 'is_show': bool, 'buff_mold': int, 'buff_apply': int,
     'buff_end': int, 'transform_target': int, 'steal_target': int, 'transform_k': list, 'transform_v': int,
     'cell_limit_target': int, 'cell_limit_k': int, 'cell_limit': int, 'add_attri': list, 'add_num': list,
     "harm_type": int, "singel": int, "card_screen": int, "card_v": int, "card_id": list,
     "random_card_id": list, "card_number": int, "card_affix": list, "summon_type": int,
     "summon_id": list, "effect_time": int, "duration": int, "duration_times": int, "max_layer": int, "can_dispel": bool
     }, type=VariableType.StaticVariable)
class Buff(BaseActor):
    def __init__(self):
        super().__init__()
        # 游戏逻辑


if __name__ == '__main__':
    generate_excel(Buff)
