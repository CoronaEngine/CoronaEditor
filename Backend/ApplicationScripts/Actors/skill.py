from Models.BaseImport import *


@auto_property({'effect_target': int, 'trigger': int, 'card_condition': int, 'card_screen': int, 'card_v': list,
                'card_number': int, 'skill_atk_type': int, 'choose_target': int, 'choose_num': int, 'choose_if': int,
                'chance': float, 'trigger_type': int, 'trigger_affix': int, 'compare_target': int, 'compare_type': list,
                "compare_screen": int, "symbol": list, "compare_v": list, "consume_number": list, "buff_id": list,
                "time_count": int, "trigger_limit": int, "cool_down_time": int, "count_limit": int,
                "is_show": int, "icon": list, "priority": int
                }, type=VariableType.StaticVariable)
class Skill(BaseActor):
    def __init__(self):
        super().__init__()
        # 游戏逻辑


if __name__ == '__main__':
    generate_excel(Skill)