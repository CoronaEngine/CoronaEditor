from Models.BaseImport import *


@auto_property({"level": int, "exp": float, "cards_bag": list, "game_stage": str, "deck_list": list}, type=VariableType.StaticVariable)
@auto_property({"cards_pool": list, "costs": int, "hands_cards": list}, type=VariableType.DynamicVariable)
class Player(BaseActor):
    def __init__(self):
        super().__init__()
        # 游戏逻辑
