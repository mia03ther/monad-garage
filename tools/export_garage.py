"""Export the Garage registry's reproducible runtime fingerprint and ABI selectors."""

import hashlib
import json
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    artifact = json.loads(
        (root / "contracts/out/GenesisGarage.sol/GenesisGarage.json").read_text(encoding="utf-8")
    )
    runtime = bytes.fromhex(artifact["deployedBytecode"]["object"].removeprefix("0x"))
    payload = {
        "runtimeHash": hashlib.sha256(runtime).hexdigest(),
        "methods": artifact["methodIdentifiers"],
    }
    (root / "frontend/garage/build.json").write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
