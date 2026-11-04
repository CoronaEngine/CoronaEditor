"""Guard the source-of-truth and the production Web/Python split."""
import json
from pathlib import Path
import xml.etree.ElementTree as ET

EDITOR = Path(__file__).resolve().parents[3]
WEB = EDITOR / "Frontend/src/services"


def test_web_catalog_matches_the_canonical_xml():
    policy = json.loads((WEB / "aiPolicy.json").read_text(encoding="utf-8"))
    root = ET.parse(WEB / "aiBlockContract.xml").getroot()
    blocks = root.findall("./Catalog/Blocks/Block")
    assert len(blocks) == len(policy["catalog"]) == 260
    for block in blocks:
        spec = policy["catalog"][block.attrib["type"]]
        assert spec["projectUsage"] == block.attrib["projectUsage"]
        assert spec["shape"] == block.attrib["shape"]
        assert set(spec["fieldSpecs"]) == {field.attrib["name"] for field in block.findall("Field")}
        assert set(spec["inputSpecs"]) == {field.attrib["name"] for field in block.findall("Input")}
        assert spec["capabilities"] == block.attrib.get("capabilities", "").split()


def test_runtime_no_longer_owns_ai_business_policy_or_project_files():
    root = EDITOR / "plugins/AITool"
    assert not (root / "cabbage_chat_policy.json").exists()
    assert not (EDITOR / "script_runtime/blockly/CoronaBlocksDocument.internal-ai-contract.xml").exists()
    for file in (root / "services").glob("*.py"):
        source = file.read_text(encoding="utf-8")
        for retired in ("worldGoal", "taskHistory", "issueMemory", "completionSignal", "workspace", "CabbageAssistant"):
            assert retired not in source, (file, retired)
