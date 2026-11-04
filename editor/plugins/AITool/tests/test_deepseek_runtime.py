"""The source and deployed facade run with only the Python standard library."""
from pathlib import Path
import shutil
import subprocess
import sys
import textwrap

import pytest

@pytest.mark.parametrize("packaged", [False, True])
def test_runtime_without_business_services_or_external_packages(tmp_path, packaged):
    root = Path(__file__).resolve().parents[3]
    if packaged:
        target = tmp_path / "中文 runtime"
        for name in ("plugins/AITool", "runtime", "config", "api"):
            shutil.copytree(root / name, target / name, ignore=shutil.ignore_patterns("tests", "__pycache__"))
        root = target
    script = textwrap.dedent("""
        import importlib.abc, io, json, os, socket, sys, time, urllib.request
        from pathlib import Path
        sys.path.insert(0, sys.argv[1])
        class Block(importlib.abc.MetaPathFinder):
            def find_spec(self, fullname, path=None, target=None):
                if fullname.split('.')[0] in {'torch','openai','langchain','Quasar','httpx','pydantic'}:
                    raise AssertionError(fullname)
        sys.meta_path.insert(0, Block())
        socket.socket.connect=lambda *args: (_ for _ in ()).throw(AssertionError('Real network'))
        from plugins.AITool.main import AITool
        from plugins.AITool.configuration import local_secrets, deepseek_settings
        local_secrets._ENV_FILE=Path(sys.argv[2])/'.env'
        for key in local_secrets._ENV_NAMES: os.environ.pop(key,None)
        deepseek_settings._SETTINGS_FILE=Path(sys.argv[2])/'options.json'
        assert not AITool.submit_request({'operation':'ai.settings.get'})['configured']
        assert AITool.initialize_runtime()
        calls=[]
        def urlopen(request,timeout):
            calls.append(request)
            result=io.BytesIO(b'{"choices":[{"message":{"content":"hello"}}]}')
            result.headers={'Content-Type':'application/json'}
            return result
        urllib.request.urlopen=urlopen
        for key in ['old-fixture','new-fixture']:
            AITool.submit_request({'operation':'ai.settings.set','payload':{'api_key':key}})
            task=AITool.submit_request({'operation':'model.start','payload':{'messages':[{'role':'user','content':'test'}]}})['taskId']
            for _ in range(300):
                result=AITool.submit_request({'operation':'model.status','taskId':task})
                if result['status']=='completed':break
                time.sleep(.002)
            assert result['content']=='hello'
            assert calls[-1].get_header('Authorization')=='Bearer '+key
        assert AITool.submit_request({'operation':'cabbage.context.load'})['error']=='UNSUPPORTED_AI_OPERATION'
        AITool.cleanup()
        assert AITool.runtime_state()[0]=='stopped'
    """)
    result = subprocess.run([sys.executable, "-S", "-c", script, str(root), str(tmp_path)], text=True, capture_output=True, timeout=20)
    assert result.returncode == 0, result.stdout + result.stderr
