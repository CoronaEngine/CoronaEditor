from Models.BaseImport import *


@auto_property({'pic': str, 'belong': int, 'Affix': list, 'vfx': int, 'tag': int, 'attack_type': int,
                'choose_target': int, 'choose_if': int, 'base_effect': int, 'effect': list, 'effect_range': list,
                'skill1': list, 'skill2': list, 'skill3': list,
                'condition': list, 'condition_affix': list, 'symbol':list, 'condition_num': list,
                'quality': int, 'upgrade': int, 'cost': int}, type=VariableType.StaticVariable)
@auto_property(
    {'health': float, 'health_raise': float, 'mana': float, 'mana_raise': float, 'attack': float, 'defence': float,
     'shield': float, 'status': int, 'crit_rate': float, 'crit_raise': float, 'dodge_rate': float, 'speed': float},
    type=VariableType.DynamicVariable)
class Cards(BaseActor):
    def __init__(self):
        super().__init__()
        # 游戏逻辑


