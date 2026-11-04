import hashlib
from concurrent.futures import ThreadPoolExecutor

from runtime.archive import script_files


def test_document_always_points_to_one_complete_revision(tmp_path, monkeypatch):
    scope = {"archive_session": "A", "project_path": str(tmp_path), "key": "target"}
    monkeypatch.setattr("runtime.project_context.read_project_session", lambda: scope)
    def save(i):
        return script_files.ProjectFiles.save({**scope, "document": {"version": i}, "code": f"# {i}"})

    with ThreadPoolExecutor(max_workers=4) as pool:
        assert all(result["status"] == "saved" for result in pool.map(save, range(12)))
    record = script_files.ProjectFiles.load(scope)
    source = (tmp_path / record["code_path"]).read_bytes()
    assert source == f"# {record['document']['version']}".encode()
    assert hashlib.sha256(source).hexdigest() == record["revision"]
    assert list((tmp_path / record["code_path"]).parent.glob("*.py")) == [tmp_path / record["code_path"]]

    original_write = script_files.atomic_replace
    def fail_index(path, data):
        if path.name == "document.json":
            raise OSError("interrupted")
        original_write(path, data)
    monkeypatch.setattr(script_files, "atomic_replace", fail_index)
    assert save(99)["status"] == "error"
    assert script_files.ProjectFiles.load(scope) == record
    monkeypatch.setattr(script_files, "atomic_replace", original_write)
    assert save(99)["status"] == "saved"
    retried = script_files.ProjectFiles.load(scope)
    assert (tmp_path / retried["code_path"]).read_bytes() == b"# 99"
