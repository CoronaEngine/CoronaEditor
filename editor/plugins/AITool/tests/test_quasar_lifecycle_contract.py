import importlib.util
import threading
import unittest
from unittest.mock import patch
from pathlib import Path


QUASAR_ROOT = Path(__file__).resolve().parents[1] / "Quasar"


def load_warmup_module():
    module_path = QUASAR_ROOT / "ai_tools" / "warmup.py"
    spec = importlib.util.spec_from_file_location("quasar_warmup_contract", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class QuasarLifecycleContractTests(unittest.TestCase):
    def test_warmup_accepts_pre_requested_stop_token(self):
        warmup = load_warmup_module()
        stop_token = threading.Event()
        stop_token.set()

        self.assertFalse(warmup.warmup_all(stop_token=stop_token))

    def test_parallel_warmup_stops_waiting_when_stop_is_requested(self):
        warmup = load_warmup_module()
        stop = threading.Event()
        task_started = threading.Event()
        release_task = threading.Event()
        warmup_finished = threading.Event()

        def blocking_task():
            task_started.set()
            release_task.wait(2.0)

        with (
            patch.object(warmup, "warmup_configs", return_value=None),
            patch.object(warmup, "warmup_storage", side_effect=blocking_task),
            patch.object(warmup, "warmup_http_clients", return_value=None),
            patch.object(warmup, "warmup_account_pools", return_value=None),
            patch.object(warmup, "warmup_tools", return_value=None),
            patch.object(warmup, "warmup_workflows", return_value=None),
            patch.object(warmup, "warmup_agent", return_value=None),
        ):
            worker = threading.Thread(
                target=lambda: (
                    warmup.warmup_all(stop_token=stop),
                    warmup_finished.set(),
                )
            )
            worker.start()
            self.assertTrue(task_started.wait(1.0))
            stop.set()
            self.assertTrue(warmup_finished.wait(0.5))
            release_task.set()
            worker.join(1.0)


if __name__ == "__main__":
    unittest.main()
