class CentralManager:
    def __init__(self):
        self.docks = {}

    def register_dock(self, routename, dock):
        self.docks[routename] = dock

    def delete_dock(self, routename):
        del self.docks[routename]

    def send_json_to_dock(self, routename, json_data):
        if routename in self.docks:
            self.docks[routename].send_message_to_dock(json_data)
        else:
            print(f"[ERROR] 未找到路由 {routename} 对应的 DockWidget")