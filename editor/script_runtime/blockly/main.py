import hashlib
import importlib.util
import json
import logging
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import uuid
from typing import Any, Optional

from runtime.editor_host import set_editor_camera_input_enabled
from runtime.project_context import read_project_session
from runtime.scene_support import cancel_pending_auto_saves

logger = logging.getLogger(__name__)


def _request_thread_stop(
    thread: threading.Thread,
    timeout: float = 3.0,
    context_id: str | None = None,
):
    """Cooperatively stop a script thread and isolate it when it misses the deadline."""
    from script_runtime.engine import corona_engine as corona_engine_scratch

    corona_engine_scratch.request_stop(context_id)
    thread.join(timeout=timeout)
    if not thread.is_alive():
        return True

    snapshot = corona_engine_scratch.runtime_context_snapshot(context_id) or {}
    reason = (
        f"thread={getattr(thread, 'name', 'scratch')} context={context_id or ''} "
        f"node={snapshot.get('current_node_id', '')}:{snapshot.get('current_node_name', '')} "
        f"missed cooperative stop deadline {timeout:.3f}s"
    )
    corona_engine_scratch.isolate_context(context_id, reason)
    logger.error("[ScratchTool] isolated non-cooperative script: %s", reason)
    return False


class ScratchTool:

    _exec_thread: Optional[threading.Thread] = None
    _exec_context_id: Optional[str] = None
    # Receipts are owned by the serialized Python service dispatcher. Keep them
    # for this host lifetime, including after a project or script finishes.
    _file_requests: dict[str, tuple[tuple | None, str | None]] = {}
    _exec_lock = threading.RLock()
    _exec_state: dict[str, Any] = {
        "status": "idle",
        "outcome": "",
        "error": "",
        "contextId": "",
        "sceneName": "",
        "actorName": "",
        "targetType": "",
        "requestedScene": "",
        "requestedActor": "",
        "resolvedSceneName": "",
        "resolvedActorName": "",
        "bindingMode": "",
        "nativeScene": "",
        "actorCandidates": [],
        "currentNodeId": "",
        "currentNodeName": "",
        "waitingEdgeId": "",
        "waitingEdgeName": "",
        "startedAt": 0.0,
        "finishedAt": 0.0,
        "inputLocked": False,
        "snapshotCaptured": False,
        "restoreStatus": "idle",
        "restoreError": "",
    }
    _exec_state_snapshot: Optional[dict[str, Any]] = None
    _exec_input_locked = False
    _persistence_lock = threading.RLock()
    _shutdown_requested = False

    # ------------------------------------------------------------------
    # Project Blockly persistence
    # ------------------------------------------------------------------
    @staticmethod
    def _request_project_context(data: dict) -> tuple[Optional[Path], Optional[dict]]:
        state = read_project_session()
        if not state.get("archive_session") or not state.get("project_path"):
            return None, {"status": "error", "code": "NO_ACTIVE_PROJECT", "message": "No project is open"}
        root = Path(state["project_path"]).resolve()
        if (data.get("archive_session") != state["archive_session"]
                or not data.get("project_path") or Path(data["project_path"]).resolve() != root):
            return None, {"status": "error", "code": "PROJECT_CONTEXT_CHANGED",
                          "message": "Project session changed; request was ignored"}
        if state.get("read_only"):
            return None, {"status": "error", "code": "READ_ONLY_PROJECT", "message": "Project is read-only"}
        return root, None

    @staticmethod
    def _blockly_dir(project_path: Path) -> Path:
        return project_path / "Scripts" / "blockly"

    @classmethod
    def _manifest_path(cls, project_path: Path) -> Path:
        return cls._blockly_dir(project_path) / "manifest.json"

    @classmethod
    def _load_manifest(cls, project_path: Path) -> dict:
        path = cls._manifest_path(project_path)
        if not path.exists():
            return {"targets": []}
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                return {"targets": []}
            targets = data.get("targets")
            if not isinstance(targets, list):
                data["targets"] = []
            return data
        except Exception:
            logger.exception("[ScratchTool] failed to load manifest: %s", path)
            return {"targets": []}

    @staticmethod
    def _atomic_write_text(path: Path, content: str) -> None:
        """Atomically replace a project file so concurrent floating panels never see it half-written."""
        path.parent.mkdir(parents=True, exist_ok=True)
        temp_path: Optional[Path] = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                newline="",
                dir=path.parent,
                prefix=f".{path.name}.",
                suffix=".tmp",
                delete=False,
            ) as handle:
                temp_path = Path(handle.name)
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path, path)
            temp_path = None
        finally:
            if temp_path is not None:
                try:
                    temp_path.unlink(missing_ok=True)
                except OSError:
                    pass

    @classmethod
    def _atomic_write_json(cls, path: Path, payload: Any) -> None:
        cls._atomic_write_text(
            path,
            json.dumps(payload, ensure_ascii=False, indent=2),
        )

    @classmethod
    def _write_manifest(cls, manifest: dict, project_path: Path) -> None:
        cls._atomic_write_json(cls._manifest_path(project_path), manifest)

    @staticmethod
    def _normalize_script_kind(script_kind: Any) -> str:
        return "node_graph" if str(script_kind or "blockly").strip().lower() == "node_graph" else "blockly"

    @classmethod
    def _target_id(
        cls,
        target_type: str,
        scene_name: str = "",
        actor_name: str = "",
        script_kind: str = "blockly",
    ) -> str:
        normalized_type = "actor" if target_type == "model" else target_type
        kind = cls._normalize_script_kind(script_kind)
        prefix = "node_graph:" if kind == "node_graph" else ""
        if normalized_type == "project":
            return f"{prefix}project:global"
        return f"{prefix}actor:{scene_name}:{actor_name}"

    @staticmethod
    def _target_digest(target_id: str) -> str:
        return hashlib.sha1(target_id.encode("utf-8")).hexdigest()[:12]

    @staticmethod
    def _normalize_payload(payload: Any) -> dict:
        if payload is None:
            return {}
        if isinstance(payload, str):
            return json.loads(payload) if payload.strip() else {}
        if isinstance(payload, dict):
            return payload
        raise TypeError("payload must be an object")

    @classmethod
    def save_blockly_target(cls, payload: dict | str) -> dict:
        """Save generated Python and workspace JSON for one Blockly or node-graph target."""
        try:
            data = cls._normalize_payload(payload)
            project_path, project_error = cls._request_project_context(data)
            if project_error:
                return project_error
            target_type = "actor" if data.get("target_type") == "model" else (data.get("target_type") or "actor")
            if target_type not in ("project", "actor"):
                return {"status": "error", "message": f"unsupported target_type: {target_type}"}

            script_kind = cls._normalize_script_kind(data.get("script_kind"))
            scene_name = str(data.get("scene_name") or "")
            actor_name = str(data.get("actor_name") or "")
            if target_type == "actor" and (not scene_name or not actor_name):
                return {"status": "error", "message": "actor target requires scene_name and actor_name"}
            if target_type == "project":
                scene_name = ""
                actor_name = ""

            target_id = cls._target_id(target_type, scene_name, actor_name, script_kind)
            digest = cls._target_digest(target_id)
            if script_kind == "node_graph":
                prefix = "node_graph_project" if target_type == "project" else "node_graph_actor"
            else:
                prefix = "project_global" if target_type == "project" else "actor"
            blockly_dir = cls._blockly_dir(project_path)
            code_path = blockly_dir / f"{prefix}_{digest}.py"
            workspace_path = blockly_dir / f"{prefix}_{digest}.blockly.json"

            # The execution context supplies the target before the module is loaded.
            code = str(data.get("code") or "")

            def _rel(path: Path) -> str:
                return path.relative_to(project_path).as_posix()

            validation_errors = data.get("validation_errors") or []
            if not isinstance(validation_errors, list):
                validation_errors = [str(validation_errors)]
            target = {
                "id": target_id,
                "target_type": target_type,
                "script_kind": script_kind,
                "scene_name": scene_name,
                "actor_name": actor_name,
                "code_path": _rel(code_path),
                "revision": hashlib.sha256(code.encode("utf-8")).hexdigest(),
                "workspace_path": _rel(workspace_path),
                "enabled": bool(data.get("enabled", True)),
                "runnable": bool(data.get("runnable", True)),
                "validation_errors": [str(item) for item in validation_errors if str(item)],
            }

            # NodeGraph can be opened in a detached CEF panel. Serialize the complete
            # workspace/code/manifest transaction and atomically replace every file so
            # another panel can never interpret a temporarily truncated manifest as an
            # empty world and overwrite the user's graph.
            with cls._persistence_lock:
                manifest = cls._load_manifest(project_path)
                previous = next((t for t in manifest["targets"] if t.get("id") == target_id), None)
                workspace = data.get("workspace") or {}
                if previous and all(previous.get(k) == v for k, v in target.items()):
                    # Run revalidates a saved graph. Keep its archive revision (and files) untouched.
                    if (code_path.is_file() and workspace_path.is_file()
                            and code_path.read_bytes() == code.encode("utf-8")
                            and workspace_path.read_bytes() == json.dumps(workspace, ensure_ascii=False, indent=2).encode("utf-8")):
                        return {"status": "saved", "target": previous, "project_path": str(project_path)}
                target["updated_at"] = time.time()
                cls._atomic_write_text(code_path, code)
                cls._atomic_write_json(workspace_path, workspace)
                targets = [t for t in manifest.get("targets", []) if t.get("id") != target_id]
                targets.append(target)
                targets.sort(
                    key=lambda t: (
                        0 if t.get("target_type") == "project" else 1,
                        t.get("scene_name", ""),
                        t.get("actor_name", ""),
                        cls._normalize_script_kind(t.get("script_kind")),
                    )
                )
                manifest["targets"] = targets
                cls._write_manifest(manifest, project_path)
            return {"status": "saved", "target": target, "project_path": str(project_path)}
        except Exception as exc:
            logger.exception("[ScratchTool] save_blockly_target failed")
            return {"status": "error", "message": str(exc)}

    @classmethod
    def load_blockly_target(cls, payload: dict | str) -> dict:
        """Load a saved Blockly or node-graph workspace for one target."""
        try:
            data = cls._normalize_payload(payload)
            project_path, project_error = cls._request_project_context(data)
            if project_error:
                return project_error
            target_type = "actor" if data.get("target_type") == "model" else (data.get("target_type") or "actor")
            if target_type not in ("project", "actor"):
                return {"status": "error", "message": f"unsupported target_type: {target_type}"}
            script_kind = cls._normalize_script_kind(data.get("script_kind"))

            scene_name = str(data.get("scene_name") or "")
            actor_name = str(data.get("actor_name") or "")
            if target_type == "project":
                scene_name = ""
                actor_name = ""
            elif not scene_name or not actor_name:
                return {"status": "error", "message": "actor target requires scene_name and actor_name"}

            target_id = cls._target_id(target_type, scene_name, actor_name, script_kind)
            with cls._persistence_lock:
                manifest = cls._load_manifest(project_path)
                target = next((item for item in manifest.get("targets", []) if item.get("id") == target_id), None)
                if not target:
                    return {
                        "status": "missing",
                        "target": {
                            "id": target_id,
                            "target_type": target_type,
                            "script_kind": script_kind,
                            "scene_name": scene_name,
                            "actor_name": actor_name,
                        },
                        "workspace": {},
                        "project_path": str(project_path),
                    }

                workspace_rel = target.get("workspace_path") or ""
                workspace_path = (project_path / workspace_rel).resolve()
                try:
                    workspace_path.relative_to(project_path)
                except ValueError:
                    return {"status": "error", "message": "workspace_path escapes active project"}
                if not workspace_path.exists():
                    return {
                        "status": "missing",
                        "target": target,
                        "workspace": {},
                        "project_path": str(project_path),
                    }
                with open(workspace_path, "r", encoding="utf-8") as f:
                    workspace = json.load(f)
            if not isinstance(workspace, dict):
                workspace = {}
            return {
                "status": "loaded",
                "target": target,
                "workspace": workspace,
                "project_path": str(project_path),
            }
        except Exception as exc:
            logger.exception("[ScratchTool] load_blockly_target failed")
            return {"status": "error", "message": str(exc)}


    # ------------------------------------------------------------------
    # Single-file execution
    # ------------------------------------------------------------------
    @classmethod
    def _replace_exec_state(cls, **updates) -> dict:
        with cls._exec_lock:
            cls._exec_state.update(updates)
            return dict(cls._exec_state)

    @classmethod
    def _set_exec_input_locked(cls, locked: bool) -> None:
        locked = bool(locked)
        with cls._exec_lock:
            cls._exec_input_locked = locked
            cls._exec_state["inputLocked"] = locked
        try:
            set_editor_camera_input_enabled(not locked, reason="node_graph")
        except Exception:
            logger.debug("[ScratchTool] node graph editor camera input gate unavailable", exc_info=True)

    @classmethod
    def has_restore_snapshot(cls) -> bool:
        with cls._exec_lock:
            return cls._exec_state_snapshot is not None

    @classmethod
    def _capture_exec_snapshot(cls, resolved: dict[str, Any]) -> tuple[Optional[dict[str, Any]], str | None]:
        try:
            from script_runtime.engine import corona_engine as corona_engine_scratch
            snapshot = corona_engine_scratch.capture_runtime_scene_state(
                resolved.get("scene_name", ""),
                resolved.get("scene"),
                resolved.get("binding_mode", ""),
            )
            return snapshot, None
        except Exception as exc:
            logger.exception("[ScratchTool] node graph state snapshot failed")
            return None, str(exc)

    @classmethod
    def _restore_exec_snapshot(cls) -> tuple[bool, str | None]:
        with cls._exec_lock:
            snapshot = cls._exec_state_snapshot
            if snapshot is None:
                # Stopping an idle/already-restored world is a successful no-op.
                cls._exec_state.update(
                    snapshotCaptured=False, restoreStatus="idle", restoreError=""
                )
                return False, None
            cls._exec_state.update(restoreStatus="restoring", restoreError="")
        try:
            cancel_pending_auto_saves()
            from script_runtime.engine import corona_engine as corona_engine_scratch
            corona_engine_scratch.restore_runtime_scene_state(snapshot)
            with cls._exec_lock:
                cls._exec_state_snapshot = None
                cls._exec_state.update(
                    snapshotCaptured=False, restoreStatus="restored", restoreError=""
                )
            return True, None
        except Exception as exc:
            logger.exception("[ScratchTool] node graph state restore failed")
            error = str(exc)
            cls._replace_exec_state(restoreStatus="error", restoreError=error)
            return False, error

    @classmethod
    def run_file(cls, request: dict) -> dict:
        """Start the exact saved revision selected by the native Scripts endpoint."""
        request_id = request.get("requestId")
        if not isinstance(request_id, str) or not 0 < len(request_id) <= 128:
            return {"status": "error", "message": "A script requestId is required"}
        root, error = cls._request_project_context(request)
        if error:
            return error
        identity = tuple(request.get(key) for key in (
            "archive_session", "project_path", "path", "revision", "target_type", "scene_name", "actor_name"))
        if request_id in cls._file_requests:
            previous, run_id = cls._file_requests[request_id]
            if run_id and previous != identity:
                return {"status": "error", "code": "REQUEST_CONFLICT", "message": "Script requestId was reused"}
            return cls.get_file_run(request)
        try:
            path = (root / request["path"]).resolve(strict=True)
            if not path.is_relative_to(root) or path.suffix != ".py":
                raise ValueError("Script must be a .py file in the active project")
            source = path.read_bytes()
            if hashlib.sha256(source).hexdigest() != request.get("revision"):
                return {"status": "error", "code": "SCRIPT_CHANGED", "message": "脚本已更改，请重新保存并运行"}
            # Compile the verified bytes; a concurrent save cannot change this run.
            program = compile(source, str(path), "exec")
        except (KeyError, TypeError, ValueError, OSError, SyntaxError) as exc:
            return {"status": "error", "message": str(exc)}
        result = cls._start_single(request.get("scene_name", ""), request.get("actor_name", ""),
                                   request.get("target_type", "actor"), filepath=path, program=program,
                                   request_id=request_id)
        if result.get("runId"):
            cls._file_requests[request_id] = (identity, result["runId"])
            result["requestId"] = request_id
        return result

    @classmethod
    def get_file_run(cls, request: dict) -> dict:
        request_id = request.get("requestId")
        record = cls._file_requests.get(request_id)
        if record is None:
            return {"status": "unknown", "requestId": request_id}
        _, run_id = record
        if run_id is None:
            return {"status": "cancelled", "requestId": request_id}
        with cls._exec_lock:
            state = cls._exec_state if run_id == cls._exec_state.get("runId") else {}
            return {"status": state.get("status", "finished"), "runId": run_id,
                    "requestId": request_id, "snapshotCaptured": bool(state.get("snapshotCaptured"))}

    @classmethod
    def stop_file(cls, request: dict) -> dict:
        run_id = request.get("runId")
        request_id = request.get("requestId")
        if request_id and not run_id:
            # A close can overtake a delayed start. Remember cancellation so a
            # late delivery or retry cannot launch a script for a closed panel.
            record = cls._file_requests.setdefault(request_id, (None, None))
            run_id = record[1]
            if not run_id or run_id != cls._exec_state.get("runId"):
                return {"status": "stopped", "requestId": request_id}
        if not run_id or run_id != cls._exec_state.get("runId"):
            return {"status": "error", "code": "STALE_RUN", "message": "脚本运行实例已更改"}
        return cls.stop_script_execution(request.get("restore_state", True))

    @classmethod
    def _start_single(cls, scene_name, actor_name, target_type, *, filepath, program, request_id) -> dict:
        if cls._shutdown_requested:
            return {"status": "error", "message": "Scratch runtime is shutting down"}
        try:
            from script_runtime.engine import corona_engine as corona_engine_scratch

            with cls._exec_lock:
                active_thread = bool(cls._exec_thread and cls._exec_thread.is_alive())
                if active_thread:
                    return {
                        "status": "error",
                        "message": "上一次节点图脚本仍在结束中，请稍后重试",
                        "outcome": "execution_finishing",
                    }
                if cls._exec_state_snapshot is not None:
                    return {
                        "status": "error",
                        "message": "上一次节点图运行仍保留可恢复快照，请先停止并恢复或重新加载编辑器",
                        "outcome": "snapshot_pending",
                    }

            requested_scene = scene_name or ""
            requested_actor = actor_name or ""
            target_type = "actor" if str(target_type or "actor").lower() == "model" else str(target_type or "actor").lower()
            resolved = corona_engine_scratch.resolve_runtime_target(
                target_type, scene_name, actor_name
            )
            if resolved.get("status") != "ok":
                message = str(resolved.get("message") or "无法绑定运行目标")
                cls._replace_exec_state(
                    status="error",
                    outcome="binding_error",
                    error=message,
                    contextId="",
                    sceneName=scene_name or "",
                    actorName=actor_name or "",
                    targetType=target_type,
                    requestedScene=requested_scene,
                    requestedActor=requested_actor,
                    resolvedSceneName="",
                    resolvedActorName="",
                    bindingMode=resolved.get("binding_mode", ""),
                    nativeScene=resolved.get("native_scene", ""),
                    actorCandidates=resolved.get("actor_candidates", []),
                    currentNodeId="",
                    currentNodeName="",
                    waitingEdgeId="",
                    waitingEdgeName="",
                    startedAt=time.time(),
                    finishedAt=time.time(),
                )
                return {
                    "status": "error", "message": message, "outcome": "binding_error",
                    "requestedScene": requested_scene, "requestedActor": requested_actor,
                    "nativeScene": resolved.get("native_scene", ""),
                    "actorCandidates": resolved.get("actor_candidates", []),
                    "bindingMode": resolved.get("binding_mode", ""),
                }

            target_type = resolved.get("target_type", target_type)
            scene_name = resolved.get("scene_name", scene_name)
            actor_name = resolved.get("actor_name", actor_name)
            state_snapshot, snapshot_error = cls._capture_exec_snapshot(resolved)
            if state_snapshot is None:
                message = f"无法创建运行前场景快照: {snapshot_error or '未知错误'}"
                with cls._exec_lock:
                    cls._exec_state_snapshot = None
                cls._set_exec_input_locked(False)
                cls._replace_exec_state(
                    status="error", outcome="snapshot_error", error=message,
                    inputLocked=False, snapshotCaptured=False,
                    restoreStatus="idle", restoreError="",
                    finishedAt=time.time(),
                )
                return {"status": "error", "message": message, "outcome": "snapshot_error"}
            with cls._exec_lock:
                cls._exec_state_snapshot = state_snapshot

            run_id = uuid.uuid4().hex
            context_id = run_id
            started_at = time.time()
            cls._replace_exec_state(
                status="starting",
                outcome="",
                error="",
                contextId=context_id,
                runId=run_id,
                requestId=request_id,
                sceneName=scene_name,
                actorName=actor_name,
                targetType=target_type,
                requestedScene=requested_scene,
                requestedActor=requested_actor,
                resolvedSceneName=scene_name,
                resolvedActorName=actor_name,
                bindingMode=resolved.get("binding_mode", ""),
                nativeScene=resolved.get("native_scene", ""),
                actorCandidates=resolved.get("actor_candidates", []),
                currentNodeId="",
                currentNodeName="",
                waitingEdgeId="",
                waitingEdgeName="",
                startedAt=started_at,
                finishedAt=0.0,
                inputLocked=True,
                snapshotCaptured=True,
                restoreStatus="idle",
                restoreError="",
            )
            cls._set_exec_input_locked(True)

            def _run_in_thread():
                outcome = cls._run_code_file(
                    filepath,
                    {
                        "id": context_id,
                        "target_type": target_type,
                        "scene_name": scene_name,
                        "actor_name": actor_name,
                        "_resolved": resolved,
                    },
                    program=program,
                )
                if outcome == "stop_restore":
                    # Do not restore from the script thread: the stop coordinator
                    # must be free to wait for handlers before restoring the scene.
                    with cls._exec_lock:
                        cls._exec_state.update(
                            status="stopping",
                            outcome=outcome,
                            finishedAt=time.time(),
                        )
                        if cls._exec_thread is threading.current_thread():
                            cls._exec_thread = None
                    threading.Thread(
                        target=cls.stop_script_execution,
                        args=(True,),
                        daemon=True,
                        name="blockly-exec-stop-restore",
                    ).start()
                    return

                with cls._exec_lock:
                    current_status = cls._exec_state.get("status")
                    if current_status not in ("error", "stopped"):
                        final_status = "completed" if outcome == "completed" else "stopped" if outcome in ("stopped", "restart") else "error"
                        cls._exec_state.update(
                            status=final_status,
                            outcome=outcome,
                            finishedAt=time.time(),
                        )
                    cls._set_exec_input_locked(False)
                    if cls._exec_thread is threading.current_thread():
                        cls._exec_thread = None

            with cls._exec_lock:
                cls._exec_context_id = context_id
                cls._exec_thread = threading.Thread(
                    target=_run_in_thread, daemon=True, name="blockly-exec"
                )
                cls._exec_thread.start()

            return {
                "status": "started",
                "filepath": str(filepath),
                "runId": run_id,
                "contextId": context_id,
                "sceneName": scene_name,
                "actorName": actor_name,
                "targetType": target_type,
                "requestedScene": requested_scene,
                "requestedActor": requested_actor,
                "resolvedSceneName": scene_name,
                "resolvedActorName": actor_name,
                "bindingMode": resolved.get("binding_mode", ""),
            }
        except Exception as exc:
            cls._set_exec_input_locked(False)
            with cls._exec_lock:
                cls._exec_state_snapshot = None
            logger.exception("[ScratchTool] file startup failed")
            cls._replace_exec_state(
                status="error", outcome="startup_error", error=str(exc), finishedAt=time.time()
            )
            return {"status": "error", "message": str(exc)}

    @classmethod
    def stop_script_execution(cls, restore_state: bool = False) -> dict:
        from script_runtime.engine import corona_engine as corona_engine_scratch

        thread_to_stop = None
        context_id = None
        with cls._exec_lock:
            context_id = cls._exec_context_id
            if cls._exec_thread and cls._exec_thread.is_alive():
                thread_to_stop = cls._exec_thread

        if thread_to_stop is not None:
            thread_stopped = _request_thread_stop(
                thread_to_stop, timeout=0.5, context_id=context_id
            )
        elif context_id:
            corona_engine_scratch.request_stop(context_id)
            thread_stopped = True
        else:
            thread_stopped = True

        child_threads = (
            corona_engine_scratch.active_child_threads({context_id}) if context_id else []
        )
        pending_children = cls._wait_for_threads(child_threads, 0.75)
        if pending_children:
            corona_engine_scratch.isolate_context(
                context_id,
                "child script threads missed cooperative stop deadline: "
                + ", ".join(sorted({child.name for child in pending_children})),
            )

        if not thread_stopped or pending_children:
            names = [thread_to_stop.name] if thread_to_stop and thread_to_stop.is_alive() else []
            names.extend(child.name for child in pending_children)
            message = "脚本未协作停止，已隔离且未恢复场景: " + ", ".join(sorted(set(names)))
            cls._set_exec_input_locked(False)
            with cls._exec_lock:
                cls._exec_state.update(
                    status="error",
                    outcome="stop_timeout",
                    error=message,
                    finishedAt=time.time(),
                    inputLocked=False,
                )
            return {
                "status": "error",
                "message": message,
                "restored": False,
                "pendingThreads": sorted(set(names)),
            }

        restored = False
        restore_error = None
        if bool(restore_state):
            restored, restore_error = cls._restore_exec_snapshot()
        else:
            with cls._exec_lock:
                cls._exec_state_snapshot = None
                cls._exec_state.update(snapshotCaptured=False, restoreStatus="idle", restoreError="")

        cls._set_exec_input_locked(False)
        with cls._exec_lock:
            cls._exec_thread = None
            cls._exec_context_id = None
            cls._exec_state.update(
                status="stopped",
                outcome="stopped",
                error="" if not restore_error else f"场景恢复失败: {restore_error}",
                finishedAt=time.time(),
                inputLocked=False,
            )
        result = {
            "status": "stopped",
            "restored": restored,
            "snapshotCaptured": cls._exec_state_snapshot is not None,
            "restoreStatus": cls._exec_state.get("restoreStatus", "idle"),
        }
        if restore_error:
            result["restoreError"] = restore_error
            result["message"] = f"已停止，但场景恢复失败: {restore_error}"
        return result

    @classmethod
    def request_shutdown(cls) -> None:
        from script_runtime.engine import corona_engine as corona_engine_scratch

        cls._shutdown_requested = True
        corona_engine_scratch.request_stop_all()

    @classmethod
    def shutdown(cls, timeout: float = 1.0) -> dict:
        """Bounded service shutdown; never restores state while workers remain alive."""
        from script_runtime.engine import corona_engine as corona_engine_scratch

        cls.request_shutdown()
        with cls._exec_lock:
            exec_thread = cls._exec_thread
            exec_context = cls._exec_context_id
        context_ids = {exec_context} if exec_context else set()
        threads = [exec_thread] if exec_thread else []
        threads.extend(corona_engine_scratch.active_child_threads(context_ids or None))
        pending = cls._wait_for_threads(
            list({thread for thread in threads if thread}),
            max(0.0, float(timeout)),
        )
        if pending:
            reason = "Scratch service shutdown timeout: " + ", ".join(
                sorted({thread.name for thread in pending})
            )
            for context_id in context_ids:
                corona_engine_scratch.isolate_context(context_id, reason)
            cls._set_exec_input_locked(False)
            return {
                "service": "ScratchTool",
                "state": "stop_timeout",
                "thread_alive": True,
                "pending_threads": sorted({thread.name for thread in pending}),
            }
        cls._set_exec_input_locked(False)
        return {
            "service": "ScratchTool",
            "state": "stopped",
            "thread_alive": False,
            "pending_threads": [],
        }

    @classmethod
    def snapshot(cls) -> dict:
        with cls._exec_lock:
            exec_thread = cls._exec_thread
        alive = [exec_thread.name] if exec_thread and exec_thread.is_alive() else []
        return {
            "service": "ScratchTool",
            "state": "stop_requested" if cls._shutdown_requested else "ready",
            "thread_alive": bool(alive),
            "pending_threads": sorted(alive),
        }

    @classmethod
    def get_script_status(cls) -> dict:
        from script_runtime.engine import corona_engine as corona_engine_scratch

        with cls._exec_lock:
            state = dict(cls._exec_state)
            state["inputLocked"] = bool(cls._exec_input_locked)
            state["snapshotCaptured"] = cls._exec_state_snapshot is not None
            context_id = cls._exec_context_id or state.get("contextId")
            thread_alive = bool(cls._exec_thread and cls._exec_thread.is_alive())
            if cls._exec_thread is not None and not thread_alive:
                cls._exec_thread = None
        state["threadAlive"] = thread_alive
        snapshot = corona_engine_scratch.runtime_context_snapshot(context_id) if context_id else None
        if snapshot:
            state.update(
                currentNodeId=snapshot.get("current_node_id", ""),
                currentNodeName=snapshot.get("current_node_name", ""),
                waitingEdgeId=snapshot.get("waiting_edge_id", ""),
                waitingEdgeName=snapshot.get("waiting_edge_name", ""),
            )
            binding_error = snapshot.get("binding_error", "")
            if binding_error and not state.get("error"):
                state["error"] = binding_error
        status_name = str(state.get("status") or "idle")
        started_at = float(state.get("startedAt") or 0.0)
        starting_recently = (
            status_name == "starting"
            and started_at > 0.0
            and (time.time() - started_at) < 1.0
        )
        if thread_alive and status_name not in ("starting", "running"):
            state["status"] = "running"
        elif not thread_alive and not starting_recently:
            # A status string can survive a project switch or an interrupted worker.
            # Only a live worker may own the node-graph camera input lock.
            cls._set_exec_input_locked(False)
            state["inputLocked"] = False
            if status_name in ("starting", "running", "stopping"):
                terminal_status = "stopped" if status_name == "stopping" else "completed"
                terminal_outcome = str(state.get("outcome") or terminal_status)
                with cls._exec_lock:
                    cls._exec_state.update(
                        status=terminal_status,
                        outcome=terminal_outcome,
                        finishedAt=float(state.get("finishedAt") or time.time()),
                        inputLocked=False,
                    )
                state.update(
                    status=terminal_status,
                    outcome=terminal_outcome,
                    finishedAt=float(state.get("finishedAt") or time.time()),
                )
        return state

    # ------------------------------------------------------------------
    # File execution helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _wait_for_threads(threads: list[threading.Thread], timeout: float) -> list[threading.Thread]:
        """在统一截止时间内等待线程，避免按物体逐个累计超时。"""
        current = threading.current_thread()
        pending = [thread for thread in threads if thread and thread is not current and thread.is_alive()]
        deadline = time.monotonic() + max(0.0, float(timeout))
        while pending and time.monotonic() < deadline:
            for thread in list(pending):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                thread.join(timeout=min(0.01, remaining))
            pending = [thread for thread in pending if thread.is_alive()]
        return pending

    @classmethod
    def _run_code_file(cls, code_path: Path, target: dict, program) -> str:
        from script_runtime.engine import corona_engine as corona_engine_scratch

        context_id = target.get("id") or cls._target_id(
            target.get("target_type", "actor"),
            target.get("scene_name", ""),
            target.get("actor_name", ""),
        )
        ctx = corona_engine_scratch.create_context(
            context_id=context_id,
            target_type=target.get("target_type", "actor"),
            scene_name=target.get("scene_name", ""),
            actor_name=target.get("actor_name", ""),
        )
        resolved = target.get("_resolved") if isinstance(target.get("_resolved"), dict) else {}
        if ctx.target_type == "project" and resolved.get("scene") is not None:
            # Keep project-global semantics while attaching the active scene so
            # explicit object blocks can resolve native editor actors by name.
            ctx.scene = resolved.get("scene")
            ctx.target_scene = ctx.scene
            ctx.scene_name = str(resolved.get("scene_name") or ctx.scene_name or "")
            ctx.target_scene_name = ctx.scene_name
        corona_engine_scratch.bind_context(ctx)

        module_name = f"blockly_runtime_{cls._target_digest(context_id)}_{int(time.time() * 1000)}"
        outcome = "completed"
        try:
            spec = importlib.util.spec_from_file_location(module_name, code_path)
            if spec is None or spec.loader is None:
                raise RuntimeError(f"无法加载积木脚本: {code_path}")
            module = importlib.util.module_from_spec(spec)
            sys.modules[module_name] = module
            exec(program, module.__dict__)
            cls._replace_exec_state(status="running", outcome="", error="")
            module.run()
            if corona_engine_scratch.has_runtime_handlers(ctx) and not ctx.stop_requested:
                while not ctx.stop_requested:
                    corona_engine_scratch.wait(0.1)
            requested_state = ctx.game_state or ctx.variables.get("game_state")
            if requested_state == "stop_restore":
                outcome = "stop_restore"
                logger.info("[ScratchTool] stop-and-restore requested: %s", context_id)
            elif requested_state == "restart":
                outcome = "restart"
                logger.info("[ScratchTool] level restart requested: %s", context_id)
            elif requested_state in ("win", "over"):
                outcome = "game_end"
                logger.info("[ScratchTool] game ended (%s): %s", requested_state, context_id)
            elif ctx.stop_requested:
                outcome = "stopped"
                logger.info("[ScratchTool] script stopped: %s", context_id)
        except SystemExit:
            requested_state = ctx.game_state or ctx.variables.get("game_state")
            if requested_state == "restart":
                outcome = "restart"
                logger.info("[ScratchTool] level restart requested: %s", context_id)
            elif requested_state == "stop_restore":
                outcome = "stop_restore"
                logger.info("[ScratchTool] stop-and-restore requested: %s", context_id)
            elif requested_state in ("win", "over"):
                outcome = "game_end"
                logger.info("[ScratchTool] game ended (%s): %s", requested_state, context_id)
            else:
                outcome = "stopped"
                logger.info("[ScratchTool] script stopped: %s", context_id)
        except Exception as exc:
            outcome = "error"
            logger.exception("[ScratchTool] script failed: %s", context_id)
            cls._replace_exec_state(outcome="error", error=str(exc), finishedAt=time.time())
        finally:
            snapshot = corona_engine_scratch.runtime_state_snapshot(ctx)
            cls._replace_exec_state(
                currentNodeId=snapshot.get("current_node_id", ""),
                currentNodeName=snapshot.get("current_node_name", ""),
                waitingEdgeId=snapshot.get("waiting_edge_id", ""),
                waitingEdgeName=snapshot.get("waiting_edge_name", ""),
            )
            sys.modules.pop(module_name, None)
            corona_engine_scratch.release_context(ctx)
        return outcome

    # ------------------------------------------------------------------
    # Input bridge
    # ------------------------------------------------------------------
    @classmethod
    def key_event(cls, key: str, modifiers: str = "", display_key: str = "") -> dict:
        from script_runtime.engine import corona_engine as corona_engine_scratch

        mods = [m.strip() for m in modifiers.split(",") if m.strip()] if modifiers else []
        corona_engine_scratch.handle_key_event(key, mods, display_key or key)
        return {"status": "ok"}

    @classmethod
    def key_release(cls, key: str, display_key: str = "") -> dict:
        from script_runtime.engine import corona_engine as corona_engine_scratch

        corona_engine_scratch.handle_key_release(key, display_key or key)
        return {"status": "ok"}

    @classmethod
    def mouse_event(
        cls,
        event_type: str,
        button: str = "",
        x: float = 0.0,
        y: float = 0.0,
        viewport_x: float | None = None,
        viewport_y: float | None = None,
        viewport_width: float | None = None,
        viewport_height: float | None = None,
        picked_actor: str = "",
    ) -> dict:
        from script_runtime.engine import corona_engine as corona_engine_scratch

        corona_engine_scratch.handle_mouse_event(
            event_type, button, x, y,
            viewport_x, viewport_y, viewport_width, viewport_height,
            picked_actor,
        )
        return {"status": "ok"}
