# Relaunch verification — 2026-11-18

Branch: `codex/genesis-relaunch`, isolated checkout
`D:\Github\project-genesis-studio`. The original checkout's unfinished work
was not discarded or overwritten. Public main was not merged.

Environment: Python 3.12.14, Node 24.19.0, Foundry 1.8.7, Solc 0.8.29,
Windows. The Python environment in the original checkout was reused, with
the working directory and pytest pythonpath selecting this checkout.

## Actual commands and outcomes

```powershell
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
& D:\Github\project-genesis\.venv\Scripts\python.exe -m pytest -q
& D:\Github\project-genesis\.venv\Scripts\python.exe -m mypy --strict genesis main.py tools/export_community.py
forge test --root contracts -vv
& D:\Github\project-genesis\.venv\Scripts\python.exe tools/export_community.py
node --test frontend/community/verify.mjs frontend/sandbox/verify.mjs frontend/studio/verify.mjs
$env:GENESIS_PYTHON = 'D:\Github\project-genesis\.venv\Scripts\python.exe'
node frontend/community/e2e.mjs
node frontend/verify_engine.mjs
node frontend/verify_epochs.mjs
node frontend/rehearse_demo.mjs
node --check frontend/community/app.js
node --check frontend/sandbox/scene.js
git diff --check
```

- Python: **638 passed in 33.29s**, no skips. This includes the original
  simulation/harness checks and three new relay/static-wiring checks.
- Strict mypy: **26 source files clean**.
- Solidity: **13 passed**, including the 256-case refund fuzz test. These
  cover deadline start/expiry, success persistence/free-build, cooperation,
  disconnected power, removal of excess load completing the goal, bounds,
  occupied-tile races, owner-only removal and allowance conservation.
- Node: **22 passed** (6 community model checks, 7 earlier builder
  checks, 9 earlier observatory checks).
- Existing engine: **10/10 golden worlds**, **3/3 golden epochs** and
  **5/5 demo rehearsal assertions**. Their source was preserved.
- JavaScript syntax and whitespace checks passed. New DOM identifiers,
  module imports and HTML resource references are checked statically.

Terminal output: [pytest](relaunch-pytest.txt), [mypy](relaunch-mypy.txt),
[Node](relaunch-node.txt), [HTTP E2E](relaunch-e2e.txt). These log captures
used `2>&1 | Tee-Object`; formatting of warnings/timing may vary by system.

## Executed HTTP/chain experiment

The E2E runner actually started a private Anvil with chain ID **31337** and
one-second local blocks, deployed the current bytecode, started the Python
HTTP service, created three separate cookie jars and assigned three different
test accounts. It submitted five construction transactions, observed the
same board through all clients and checked contract-computed success.

It verified repeated request IDs return the same transaction, conflicting
IDs fail, another player cannot remove a module, occupied cells reject,
cross-origin mutations reject, unauthenticated actions reject and arbitrary
signing RPC methods are inaccessible. It then removed/rebuilt the source,
checked allowances and seven construction/removal events, tested host-only
round restart and rejected a stale-round request. The next contract started
in waiting state. All owned test processes were shut down by the runner.

Machine evidence: [relaunch-e2e.report.json](../examples/relaunch-e2e.report.json).
The report explicitly says `publicMonadTestnet: false` and
`browserUiVerified: false`. Gas usage/timing from Anvil is not a measurement
of Monad throughput, cost or finality.

## UI verification limits

The built-in browser automation call failed before creating a controllable
preview: `failed to write kernel assets` / missing path. The independent
Windows computer-use runtime returned the same startup failure. The local
Playwright Chromium headless binary subsequently rendered the landing and game
views at **390×844** and the landing at **1440×900** from a local HTTP server;
all produced non-empty screenshots and the WebGL city appeared in the mobile
game render.
This is a rendering smoke check only: no browser input or real mobile hardware
was exercised, and no Mobile Safari compatibility claim is made.

No public Monad contract deployment or wallet transaction was executed.
The creation/joining UI and read gateway are implemented and were exercised
against Anvil through their API layer. Wallet rejection, injected-provider
behavior and public-chain confirmation still need a real-browser rehearsal.

## Corrected failures during development

Startup initially assumed an immediate deployment receipt; it now waits
for the mined result. The metadata exporter initially treated all Foundry
metadata as a string; it now also accepts the parsed object form. A static
resource regex initially included `data-chain-href` attributes; the check
now uses an HTML parser. None of those initial failures is counted as a pass.

The old prototype screenshots and reports are retained as historical
evidence and do not prove the appearance or public-chain status of this
relaunch. See `DEPLOY.md` for the remaining physical-phone/public-room
checklist before a live contest demonstration.
