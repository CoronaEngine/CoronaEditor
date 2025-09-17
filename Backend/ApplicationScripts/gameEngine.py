import os


from Models.BaseImport import *


class gameEngine:
    ResoucrePool = ResourcePool(True)
    GameSetting = GameSetting()
    GamePool = GamePool()

    # print("游戏引擎启动完成")

    @staticmethod
    def loading_archive():
        # 读档
        Archive.loading(gameEngine)

    @staticmethod
    def save_archive():
        # 存档
        Archive.save(gameEngine)


if __name__ == '__main__':
    print(gameEngine.ResoucrePool.pool_list)
    print(gameEngine.ResoucrePool.actor_list)

    # 存save
    gameEngine.GamePool.init_pool(gameEngine.ResoucrePool.actor_list.get('Player'))

    player = gameEngine.ResoucrePool.actor_list.get('Player')()
    player.name = "aq2"
    player.id = 1

    gameEngine.GamePool.add_pool_actor('Player', 0, player)

    print(gameEngine.GamePool.get_pool_actor("Player", 0).name)

    gameEngine.save_archive()
    # 读save
    gameEngine.loading_archive()

    print(gameEngine.GamePool.pool_list.get('Player').get(1).name)