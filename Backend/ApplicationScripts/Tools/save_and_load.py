import json
import os.path

import numpy
from cryptography.fernet import Fernet

from Tools.settings import save_path

key = b'0ekzLWePnLjSpqcTIvPkxIHZAD-OgGfxRXRscsmAYuo='
fernet = Fernet(key)


class Archive:
    @staticmethod
    def loading(gameEngine):
        with open(os.path.join(save_path, "save1.save"), 'rb') as file:
            encrypted_data = file.read()
        decryted_data = fernet.decrypt(encrypted_data)
        # 初始化game_pool池
        data = json.loads(decryted_data.decode('utf-8'))
        for actor_name in data:
            if actor_name in gameEngine.ResoucrePool.actor_list:
                actor_class = gameEngine.ResoucrePool.actor_list.get(actor_name)
                if actor_name not in gameEngine.GamePool.pool_list:
                    gameEngine.GamePool.init_pool(actor_class)
                for member_info in data.get(actor_name):
                    member = actor_class()
                    for attr in member_info:
                        setattr(member, attr.replace('_', ''), member_info.get(attr))
                    gameEngine.GamePool.add_pool_actor(actor_class.__name__, getattr(member, 'id'), member)

    @staticmethod
    def save(gameEngine):
        # 将game_pool池对象存入存档
        actors = gameEngine.ResoucrePool.actor_list
        data_json = {}
        for actor in actors.keys():
            actor_info_list = []
            if actor in gameEngine.GamePool.pool_list:
                info_list = gameEngine.GamePool.pool_list[actors.get(actor).__name__]
                for info in info_list:
                    actor_info_list.append(info_list.get(info).__dict__)
                data_json[actors.get(actor).__name__] = actor_info_list

        json_data = json.dumps(data_json).encode('utf-8')
        encrypted_data = fernet.encrypt(json_data)
        with open(os.path.join(save_path, "save1.save"), 'wb') as file:
            file.write(encrypted_data)
