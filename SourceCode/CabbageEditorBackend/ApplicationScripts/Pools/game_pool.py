from Tools.loggings import logger


class GamePool:
    """
    游戏对象池
    """
    def __init__(self):
        self.pool_list = dict()

    def init_pool(self, pool_name):
        try:
            if pool_name.__name__ not in self.pool_list:
                self.pool_list[pool_name.__name__] = dict()
            else:
                pass
        except Exception as e:
            logger.error(str(e))
            return None

    def del_pool(self, pool_name):
        try:
            if pool_name in self.pool_list:
                self.pool_list.pop(pool_name)
            else:
                pass
        except Exception as e:
            logger.error(str(e))
            return None

    def add_pool_actor(self, pool_name, index, pool_actor):
        try:
            if pool_name in self.pool_list:
                self.pool_list[pool_name][index] = pool_actor
            else:
                self.init_pool(pool_name)
                self.pool_list[pool_name][index] = pool_actor
        except Exception as e:
            logger.error(str(e))
            return None

    def get_pool_actor(self, pool_name, index):
        try:
            if pool_name in self.pool_list and index in self.pool_list[pool_name]:
                return self.pool_list[pool_name][index]
            else:
                return None
        except Exception as e:
            logger.error(str(e))
            return None

    def del_pool_actor(self, pool_name, index):
        try:
            if pool_name in self.pool_list and index in self.pool_list[pool_name]:
                return self.pool_list[pool_name].pop(index)
            else:
                return None
        except Exception as e:
            logger.error(str(e))
            return None