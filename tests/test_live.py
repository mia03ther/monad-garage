"""Local relay boundaries; the actual chain/HTTP flow is community/e2e.mjs."""
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest

from genesis.live import LocalRoom


def test_join_is_bounded_and_session_reuse_keeps_identity() -> None:
    room = LocalRoom()
    room.accounts = ["0x" + f"{i:040x}" for i in range(1, 10)]
    with ThreadPoolExecutor(max_workers=9) as pool:
        sessions = list(pool.map(lambda i: room.join(None, f"player{i}"), range(9)))
    assert len({s[1]["address"] for s in sessions}) == 9
    token, session = sessions[0]
    assert room.join(token, "same person") == (token, session)
    with pytest.raises(ValueError, match="9"):
        room.join(None, "overflow")
    for name in ("", "x" * 21, None, 4):
        with pytest.raises(ValueError):
            room.join(None, name)


def test_action_retry_is_same_transaction_and_conflicting_key_is_rejected() -> None:
    class RecordingRoom(LocalRoom):
        calls: list[tuple[str, list[Any]]]

        def __init__(self) -> None:
            super().__init__()
            self.accounts = ["0x" + "1" * 40]
            self.contract = "0x" + "2" * 40
            self.calls = []

        def rpc(self, method: str, params: list[Any]) -> Any:
            self.calls.append((method, params))
            return "0x" + "a" * 64 if method == "eth_sendTransaction" else "0x10000"

    room = RecordingRoom()
    token, _ = room.join(None, "player")
    action = {"type": "build", "cell": 41, "kind": 2, "rotation": 0}
    result = room.action(token, "request-123", action)
    assert room.action(token, "request-123", action) == result
    assert [m for m, _ in room.calls].count("eth_sendTransaction") == 1
    with pytest.raises(ValueError, match="不同操作"):
        room.action(token, "request-123", {**action, "cell": 42})
    for invalid in ({**action, "cell": True}, {**action, "kind": 999}, {**action, "rotation": 4}, {"type": "sign", "cell": 41}):
        with pytest.raises(ValueError):
            room.action(token, "invalid-request", invalid)
    with pytest.raises(ValueError, match="加入"):
        room.action("not-a-session", "valid-id-123", action)
    with pytest.raises(ValueError, match="房间已更新"):
        room.action(token, "old-room-id", action, "stale-instance")
    assert [m for m, _ in room.calls].count("eth_sendTransaction") == 1
