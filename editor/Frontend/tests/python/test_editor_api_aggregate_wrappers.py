import unittest
from pathlib import Path


class EditorApiAggregateWrapperTests(unittest.TestCase):
    def setUp(self):
        self.source_root = Path(__file__).resolve().parents[2] / "src"
        self.api_source = (self.source_root / "api" / "editorApi.js").read_text(
            encoding="utf-8"
        )

    def test_manifest_contract_has_a_single_frontend_owner(self):
        self.assertIn("export class Bridge", self.api_source)
        self.assertIn("window.corona.editor.invoke", self.api_source)
        self.assertFalse((self.source_root / "utils" / "bridge.js").exists())
        self.assertFalse((self.source_root / "compat").exists())

    def test_services_are_thin_canonical_facades(self):
        for name in (
            "appService",
            "lanChatService",
            "networkService",
            "aiService",
            "projectLauncherService",
        ):
            path = self.source_root / "services" / f"{name}.js"
            self.assertTrue(path.is_file(), name)
            source = path.read_text(encoding="utf-8")
            self.assertNotIn("call_manifest_editor_api(", source, name)
            self.assertNotIn("window.cefQuery", source, name)

    def test_frontend_exposes_scene_and_viewport_aggregate_wrappers(self):
        for marker in (
            "readCameras: (sceneName, scope)",
            "readActorIndex: (sceneName, scope)",
            "readActorProperties: (sceneName, actor, scope)",
            "setActorTransform: (sceneName, actorName, transform)",
            "save: (sceneName, scope)",
            "selectModelFile: (sceneName, fileType = 'model', scope)",
            "setActorProperties: (sceneName, actorName, patch)",
            "captureScreenshot: (sceneName, cameraId, options)",
            "setCameraProperties: (sceneName, cameraId, patch)",
        ):
            self.assertIn(marker, self.api_source)
        self.assertNotIn('getSnapshot:', self.api_source)
        self.assertNotIn('listCameraViews:', self.api_source)
        self.assertNotIn('saveActor:', self.api_source)

    def test_project_settings_has_only_named_web_bindings(self):
        for method in ('readProjectDocument', 'commitProjectDocument', 'getActiveProjectInfo', 'saveActiveProjectInfo'):
            self.assertIn(f'window.corona.projectSettings.{method}(', self.api_source)
            self.assertNotIn(f"call_manifest_editor_api('projectSettings.{method}'", self.api_source)

    def test_frontend_exposes_only_consumed_network_and_lan_chat_aggregates(self):
        for method in ('getSessionInfo', 'setProjectRoot', 'startSession', 'stopSession',
                       'clearDiscoveredPeers', 'getDiscoveredPeers', 'searchLan', 'connectToPeer',
                       'startRoom', 'startLocalRoom', 'stopRoom', 'stopLocalRoom', 'joinRoom',
                       'leaveRoom', 'sendMessage', 'listHistoryRooms', 'loadHistoryRoom',
                       'getLocalIp', 'addAgent', 'removeAgent'):
            self.assertIn(f'{method}:', self.api_source)
        for method in ('lockObject', 'broadcastIntent', 'sendAgentReply',
                       'sendSystemMessageToHost', 'pollAgentTrigger', 'pollSyncEvent'):
            self.assertNotIn(f'{method}:', self.api_source)

    def test_active_consumers_use_aggregate_contracts(self):
        views = (
            self.source_root / "views" / "tools" / "CameraView.vue",
            self.source_root / "views" / "sidebar" / "Object.vue",
            self.source_root / "views" / "sidebar" / "SceneBar.vue",
            self.source_root / "views" / "layout" / "MainPage.vue",
        )
        for path in views:
            source = path.read_text(encoding="utf-8")
            self.assertNotIn("sceneService.listSceneTree", source, str(path))
            self.assertNotIn("sceneService.saveActor", source, str(path))


if __name__ == "__main__":
    unittest.main()
