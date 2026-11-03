"""Install editor configuration bridges without registering agents or tools."""

import threading


_INSTALL_LOCK = threading.Lock()
_installed = False


def install() -> None:
    global _installed
    with _INSTALL_LOCK:
        if _installed:
            return
        from Quasar.ai_config.paths_config import set_paths_resolver
        from Quasar.ai_tools.warmup import set_app_config_provider

        from .app_config_provider import get_app_config_for_cai
        from .paths_provider import CabbageEditorPathsResolver

        set_paths_resolver(CabbageEditorPathsResolver())
        set_app_config_provider(get_app_config_for_cai)
        _installed = True
