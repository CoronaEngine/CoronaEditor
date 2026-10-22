"""Actor descriptor templates owned by the runtime.

The template files themselves live under ``plugins/ProjectLauncher/templates``;
this module owns the filesystem copy and initialization rules.  Native
``project.*`` remains the public lifecycle contract.
"""

import configparser
import logging
import os
import shutil
from pathlib import Path


logger = logging.getLogger(__name__)


def _project_launcher_template_root() -> Path:
    """Return the canonical template owner without coupling to this module's path."""
    editor_root = Path(__file__).resolve().parents[1]
    return editor_root / "plugins" / "ProjectLauncher" / "templates"


def create_actor_from_template(target_path, scene_name):
    """Copy and initialize an actor template, adding a suffix on collision."""
    try:
        if not scene_name.endswith(".actor"):
            scene_name += ".actor"
        template_file = _project_launcher_template_root() / "actor" / "demo.actor"
        if not template_file.exists():
            raise FileNotFoundError(f"模板文件未找到: {template_file}")

        os.makedirs(target_path, exist_ok=True)
        base_name = os.path.splitext(scene_name)[0]
        target_file = os.path.join(target_path, f"{base_name}.actor")
        counter = 1
        while os.path.exists(target_file):
            target_file = os.path.join(target_path, f"{base_name}_{counter}.actor")
            counter += 1

        shutil.copy2(template_file, target_file)
        logger.info("单位文件创建成功: %s", target_file)
        update_config_name(target_file, base_name)
        return os.path.basename(target_file)
    except Exception:
        logger.exception("Actor template creation failed")
        raise


def update_config_name(target_file, file_name):
    config = configparser.ConfigParser()
    config.read(target_file, encoding="utf-8")
    config["base"]["name"] = file_name
    with open(target_file, "w", encoding="utf-8") as handle:
        config.write(handle)
