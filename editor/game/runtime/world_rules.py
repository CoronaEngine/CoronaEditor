"""World rules installed into a small world by the prophet.

Mirrors placements.py on purpose: the file lives beside the small world, so a world
carries its own rules, and a corrupt file is an error rather than a silent reset.
Pure filesystem logic: no engine imports, no scene access.

A rule is the installed form of a fragment from game/data/fragments.json. The catalogue
stays read-only content; only what the player installed belongs here.

**A rule may name the ONE object it acts on** (`target`, an actor guid): 碎片改为可作用于单独
物体. 同一块碎片可以有多条记录，每条指向不同 target，因此一块碎片可以同时装到多个物体上；
同一 target 上重复装同一块碎片仍然会被拒绝。`target` is OPTIONAL, and that is what keeps old
worlds working: a rule saved before
targets existed has no `target`, and it keeps its old meaning — it applies to every eligible
object (`storyWorldRules.mjs` `rulesFor`). The save format therefore stays `version: 1`; a
version bump would make every existing world unreadable for no gain, because nothing that reads
version 1 can tell the two rule shapes apart.

Two identities can never be a target, not even through a hand-edited file: the story map and
the prophet. The frontend already refuses both (`isMapActor` / `isProphetActor`, and
`RESERVED_TARGET_GUIDS` in storyWorldRules.mjs); this is defence in depth, and
game/tests/test_story_assets.py checks that the guids below still match the frontend's single
sources.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile

SAVE_PATH = Path('.game/story-world-rules.json')
MAX_BYTES = 65536
MAX_RULES = 64
# 每块碎片记住的最近一次调整值。拆下碎片时规则记录会消失，但这份「调参记忆」保留，
# 下次装到任意物体上仍然使用玩家最后调好的数字，而不是目录默认值。
MAX_TUNING = 16
_TYPES = ('sway', 'spin')
_AXES = ('x', 'y', 'z')
# sway 的 amplitude 是位移（米）；spin 的 amplitude 是绕轴旋转的幅度（度），两者都只要求
# `0 < 值 <= 上限`，共用同一个上限。周期上限也只有一份。
_AMPLITUDE_LIMIT = 100.0
_PERIOD_LIMIT_MS = 600_000
# 每种规则允许的轴：sway 可以沿任意一条轴平移，spin 只能绕 Z 轴旋转。
_TYPE_AXES = {'sway': _AXES, 'spin': ('z',)}
# 目标（actor guid）的长度上限。场景里的 guid 最长 38 个字符，128 留足余量又是有界的。
MAX_TARGET_LENGTH = 128
# 保留身份：地图（game/frontend/storyMap.mjs 的 MAP_GUID，也是 game/data/prophet.json 里
# map.guid）与先知（game/frontend/storyCharacters.mjs 里 role='prophet' 的角色 guid）。
_RESERVED_TARGETS = frozenset({
    'corona.story.world-map.v1',
    'f9f5c8b0-7324-4b6c-a011-000000000004',
})
RESERVED_TARGETS = _RESERVED_TARGETS


class WorldRuleError(RuntimeError):
    """Invalid data must never overwrite a good rule set."""


def _positive(value: object, *, limit: float) -> bool:
    # bool is an int subclass and would silently pass a bare number check.
    return type(value) in (int, float) and 0 < value <= limit


def _target(value: object) -> str | None:
    """The rule's target guid, or None for a legacy rule that has none.

    Absent / null is legal (legacy). Anything else must be a usable identity: a non-empty
    string within the bound that is not one of the reserved identities. Rejecting rather than
    dropping is deliberate — a rule whose target cannot be read must not silently become a
    world-wide rule, which is exactly what dropping the field would do.
    """
    if value is None:
        return None
    if not isinstance(value, str):
        raise WorldRuleError('世界规则目标无效')
    target = value.strip()
    if not target or len(target) > MAX_TARGET_LENGTH:
        raise WorldRuleError('世界规则目标无效')
    if target in _RESERVED_TARGETS:
        raise WorldRuleError('世界规则目标不能是地图或先知')
    return target


def validate_rule(entry: object) -> dict:
    if not isinstance(entry, dict):
        raise WorldRuleError('世界规则必须是对象')
    fragment_id = entry.get('fragmentId')
    if not isinstance(fragment_id, str) or not fragment_id or len(fragment_id) > 64:
        raise WorldRuleError('碎片标识无效')
    rule_type = entry.get('type')
    if rule_type not in _TYPES:
        raise WorldRuleError('未知的世界规则类型')
    if entry.get('axis') not in _AXES:
        raise WorldRuleError('未知的浮动轴')
    # 轴与类型必须配套：sway 可以沿任意一条轴平移，spin 只绕 Z 轴旋转。
    if entry.get('axis') not in _TYPE_AXES[rule_type]:
        raise WorldRuleError('该世界规则不支持这条浮动轴')
    if not _positive(entry.get('amplitude'), limit=_AMPLITUDE_LIMIT):
        raise WorldRuleError('世界规则幅度无效')
    if not _positive(entry.get('periodMs'), limit=_PERIOD_LIMIT_MS):
        raise WorldRuleError('世界规则周期无效')
    target = _target(entry.get('target'))
    rule = {'fragmentId': fragment_id, 'type': rule_type, 'axis': entry['axis'],
            'amplitude': entry['amplitude'], 'periodMs': entry['periodMs']}
    # 只有真的有时才写出 target：一条旧规则回读出来仍然是旧规则（没有 target 键），
    # 于是「作用于整个小世界」这件事不会因为一次读写往返而改变。
    if target is not None:
        rule['target'] = target
    return rule


def _tuning(value: object) -> list[dict]:
    """The remembered last-adjusted numbers of fragments, independent of installed rules.

    A fragment removed from every object leaves no rule behind, but the player's tuning is
    still theirs: this list keeps it so re-installing starts from those numbers. It is
    validated exactly like a rule's numeric fields (the catalogue itself lives in the
    frontend, so only the shared bounds and axis rules are enforced here).
    """
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > MAX_TUNING:
        raise WorldRuleError('碎片调参记忆列表无效')
    result, seen = [], set()
    for entry in value:
        if not isinstance(entry, dict):
            raise WorldRuleError('碎片调参记忆必须是对象')
        fragment_id = entry.get('fragmentId')
        if not isinstance(fragment_id, str) or not fragment_id or len(fragment_id) > 64:
            raise WorldRuleError('碎片调参记忆标识无效')
        rule_type = entry.get('type')
        if rule_type not in _TYPES:
            raise WorldRuleError('碎片调参记忆类型无效')
        if entry.get('axis') not in _TYPE_AXES[rule_type]:
            raise WorldRuleError('碎片调参记忆方向无效')
        if not _positive(entry.get('amplitude'), limit=_AMPLITUDE_LIMIT):
            raise WorldRuleError('碎片调参记忆幅度无效')
        if not _positive(entry.get('periodMs'), limit=_PERIOD_LIMIT_MS):
            raise WorldRuleError('碎片调参记忆周期无效')
        if fragment_id in seen:
            raise WorldRuleError('碎片调参记忆不能重复')
        seen.add(fragment_id)
        result.append({'fragmentId': fragment_id, 'type': rule_type, 'axis': entry['axis'],
                       'amplitude': entry['amplitude'], 'periodMs': entry['periodMs']})
    return result


def validate_state(state: object) -> dict:
    if not isinstance(state, dict) or state.get('version') != 1:
        raise WorldRuleError('不支持的世界规则存档版本')
    raw = state.get('rules')
    if not isinstance(raw, list) or len(raw) > MAX_RULES:
        raise WorldRuleError('世界规则列表无效')
    rules, seen = [], set()
    for entry in raw:
        rule = validate_rule(entry)
        # 同一块碎片可以同时装到多个物体上：每条记录仍然是「一块碎片 × 一个目标」，
        # 因此重复键是 (fragmentId, target)，而不是单独的 fragmentId。旧规则没有 target，
        # 仍然只允许存在一条，避免同一块碎片出现两条「作用于整个世界」的记录。
        key = (rule['fragmentId'], rule.get('target'))
        if key in seen:
            raise WorldRuleError('同一碎片不能重复装到同一个物体上')
        seen.add(key)
        rules.append(rule)
    # 同一块碎片一旦有定向记录，旧版留下的无 target 记录就不能再保留：它表示「整个世界」，
    # 会让玩家选中部分物体后仍然看到所有物体都在动。读取和保存都在这里归一化。
    targeted_fragments = {rule['fragmentId'] for rule in rules if rule.get('target')}
    rules = [rule for rule in rules
             if rule.get('target') or rule['fragmentId'] not in targeted_fragments]
    tuning = _tuning(state.get('tuning'))
    result = {'version': 1, 'rules': rules}
    if tuning:
        result['tuning'] = tuning
    return result


def initial_state() -> dict:
    return {'version': 1, 'rules': []}


def load(root: Path) -> dict:
    """A missing file is an empty rule set; a corrupt one is an error, never a reset."""
    path = Path(root) / SAVE_PATH
    if not path.exists():
        return initial_state()
    try:
        if path.stat().st_size > MAX_BYTES:
            raise WorldRuleError('世界规则存档超过大小限制')
        return validate_state(json.loads(path.read_text(encoding='utf-8')))
    except (OSError, ValueError, TypeError, KeyError) as error:
        raise WorldRuleError(f'世界规则存档损坏，未覆盖原文件：{error}') from error


def save(root: Path, rules: object, tuning: object = None) -> dict:
    state = validate_state({'version': 1, 'rules': rules, 'tuning': tuning})
    folder = Path(root) / '.game'
    folder.mkdir(exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.story-world-rules-', suffix='.tmp', dir=folder)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
            json.dump(state, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, Path(root) / SAVE_PATH)
    finally:
        Path(temporary).unlink(missing_ok=True)
    return state


def clear(root: Path) -> dict:
    return save(root, [])
