from Models.BaseImport import *
from Actors.cards import Cards


class Magic(Cards):
    def __init__(self):
        super().__init__()
        # 游戏逻辑

if __name__ == '__main__':
    generate_excel(Magic)