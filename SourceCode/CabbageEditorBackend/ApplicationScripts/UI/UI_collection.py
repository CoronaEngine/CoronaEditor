

class page_collection:
    collection_list = {}
    now_ui = "main"

    @staticmethod
    def add_ui(ui_name, ui_content):
        if ui_name not in page_collection.collection_list:
            page_collection.collection_list.update({ui_name: ui_content})

    @staticmethod
    def get_ui(ui_name):
        if ui_name in page_collection.collection_list:
            return page_collection.collection_list[ui_name]
        else:
            return None

    @staticmethod
    def show_ui(ui_name):
        if ui_name in page_collection.collection_list:
            page_collection.collection_list[page_collection.now_ui].hide()
            page_collection.collection_list[ui_name].show()
            page_collection.now_ui = ui_name
            return True
        else:
            return False

