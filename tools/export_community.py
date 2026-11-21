"""Export a compiled registry for the static wallet client; run forge build first."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
artifact = json.loads((root / "contracts/out/GenesisCommunity.sol/GenesisCommunity.json").read_text())
metadata = artifact["metadata"]
if isinstance(metadata, str):
    metadata = json.loads(metadata)
runtime = artifact["deployedBytecode"]["object"]
payload = {
    "name": "GenesisCommunity",
    "compiler": metadata["compiler"]["version"],
    "creationBytecode": artifact["bytecode"]["object"],
    "runtimeHash": hashlib.sha256(bytes.fromhex(runtime.removeprefix("0x"))).hexdigest(),
    "runtimeBytecode": runtime,
}
(root / "frontend/community/build.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
print("Exported GenesisCommunity runtime SHA-256:", payload["runtimeHash"])
