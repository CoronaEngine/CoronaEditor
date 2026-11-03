from pathlib import Path
import unittest


REPO_ROOT = next(
    path for path in Path(__file__).resolve().parents
    if (path / "src/systems/network/network_system.cpp").is_file()
)


class NativeNetworkSyncContractTests(unittest.TestCase):
    def test_native_sources_expose_and_produce_sync_queue_events(self) -> None:
        header = (REPO_ROOT / "include/corona/systems/network/network_system.h").read_text(encoding="utf-8")
        network = (REPO_ROOT / "src/systems/network/network_system.cpp").read_text(encoding="utf-8")
        handlers = (REPO_ROOT / "src/systems/ui/editor_api/cef_editor_api.cpp").read_text(encoding="utf-8")

        self.assertIn("struct LanChatSyncEvent", header)
        self.assertIn("lanchat_pop_sync_event", header)
        self.assertIn('"actor_create_received"', network)
        self.assertIn('"actor_imported"', network)
        self.assertIn('"actor_transform"', network)
        self.assertIn('"actor_deleted"', network)
        self.assertIn('"asset_transfer_completed"', network)
        self.assertIn('"scene_snapshot_received"', network)
        self.assertIn('"scene_snapshot_peer_ack"', network)
        policy = (REPO_ROOT / "include/corona/systems/network/scene_snapshot_policy.h").read_text(encoding="utf-8")
        self.assertIn("Network::classify_scene_snapshot(snapshot_kind)", network)
        self.assertIn("Network::SceneSnapshotDisposition::PeerAcknowledgement", network)
        self.assertIn('snapshot_kind == "peer_ack"', policy)
        self.assertIn('"host_identity_fingerprint"', network)
        self.assertIn('"peer_identity_fingerprint"', network)
        self.assertIn('snapshot.value("plan_id"', network)
        self.assertIn('is_message_from_connected_host(sender_peer_id)', network)
        self.assertIn('? "remote_host"', network)
        self.assertIn(': "remote_peer"', network)
        self.assertIn("is_coalescible_sync_event", network)
        self.assertIn("kSoftMaxPendingLanChatSyncEvents", network)
        self.assertIn("kHardMaxPendingLanChatSyncEvents", network)
        self.assertIn("actor_id_from_payload", network)
        self.assertNotIn("kMaxPendingLanChatSyncEvents = 256", network)
        self.assertIn('"lan_chat.poll_sync_event"', handlers)
