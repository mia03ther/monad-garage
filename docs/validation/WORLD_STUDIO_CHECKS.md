# World Observatory validation

Recorded for the feature branch `codex/genesis-world-studio`, based on
`origin/main` at `efa73e4`. Work was isolated in
`D:\Github\project-genesis-studio`; the older checkout's unfinished changes
were left intact. The Python virtual environment was reused from the
older checkout, while pytest's configured `pythonpath = ["."]` and the
working directory selected the new checkout's code.

Environment: Windows, Python **3.12.14**, Node **v24.19.0**, Foundry
**1.8.7** (`anvil` and `cast` installed). No external model or public-chain
transaction was used in this validation.

## Executed checks

From `D:\Github\project-genesis-studio`:

```powershell
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
& 'D:\Github\project-genesis\.venv\Scripts\python.exe' -m pytest -q
& 'D:\Github\project-genesis\.venv\Scripts\python.exe' -m mypy --strict genesis main.py
node frontend/verify_engine.mjs
node frontend/verify_epochs.mjs
node frontend/rehearse_demo.mjs
node --test frontend/studio/verify.mjs
node --check frontend/studio/app.js
node --check frontend/studio/scene.js
git diff --check
```

- Full Python suite on the final code: **635 passed in 39.29s**, no skips.
  This includes all three existing local Anvil integration tests. The first
  full run also passed (635 in 52.43s).
- Strict mypy: **no issues in 24 source files**. The initial check found four
  pre-existing annotation errors in `chain.py`, `betting.py` and `cli.py`.
  A JSON return cast, a `list[Bet]` annotation and removal of two unused
  ignores fixed them without changing simulation behavior. The affected
  CLI/betting tests separately passed: **32 passed in 3.78s**.
- Existing browser engine: **10/10 golden worlds**, including scarcity,
  different taxes/populations/seeds and a 365-day run.
- Existing epochs: **3/3 golden epochs**.
- Existing demo rehearsal: **5/5 assertions**; fast-forward took **223ms**
  in that run, with the play-money payout sum equal to the pool. This is
  an observed local measurement, not a cross-device performance promise.
- Observatory: **9/9 Node tests**. They cover incremental/canonical equality,
  rewinding, snapshot isolation, input rejection, actual scarcity/survival,
  movement/collision/jump, finite/selectable scene geometry, disposal and
  replaying the actual browser-exported JSON report.
- Both JavaScript syntax checks and the whitespace check exited zero.

Captured terminal output (final runs used `2>&1 | Tee-Object -FilePath …`):
[pytest](world-studio-pytest.txt), [mypy](world-studio-mypy.txt),
[Node tests](world-studio-node.txt).

## Browser execution

The local preview was started with the equivalent direct argument list:

```powershell
& 'D:\Github\project-genesis\.venv\Scripts\python.exe' -m http.server 8021 --bind 127.0.0.1 --directory D:\Github\project-genesis-studio\frontend
```

The test service was launched hidden, with stdout/stderr redirected to
local preview log files outside the repository. HTTP requests returned
**200** for `world.html`, all five runtime studio modules/styles, both
Three.js runtime modules and `engine.js`.

The actual in-app browser, with WebGL rendering, was used to:

1. Enter the scene, predict Cinder and visit its campus.
2. Hold W to move, drag to aim, and press E to inspect its market; day-one
   holdings were food **26**, wood **30**, stone **28**.
3. Fast-forward to day 60: Cinder won; its cumulative trades were **585**.
4. Open the ledger and execute the independent recomputation. The displayed
   result was **与参考纪元逐字段一致**.
5. Download the actual JSON and save it as
   [`../examples/world-studio-42.report.json`](../examples/world-studio-42.report.json).
6. Rewind through the date control to day 20, finish and recompute again:
   the digest remained
   `b25c8fb3e94f746bf4d29fd7118ecd0fb72b23b8386eda76b35830e00cfab9fc`.
7. Reset: day zero, zero trades, no prediction, export disabled.
8. Check desktop **1366×864** and narrow **390×844** layouts. On the narrow
   layout, entering, day advancement and directional controls were usable;
   document width equaled viewport width, with no horizontal overflow.
9. Confirm direct civilization selection hides the initial welcome card,
   preventing the inspector from being obscured. Restore the browser's
   default viewport and leave the preview at a fresh start.

Pointer lock was unavailable in this browser, and its documented drag-look
fallback was used successfully. The captured browser warning/error log
was empty at the check; this is not an assertion about every future run.

Screenshots: [campus](world-studio-campus.jpg),
[verified ledger](world-studio-desktop.jpg),
[narrow screen](world-studio-mobile.jpg). Screenshots show real rendering,
not concept art.

## Limits of this evidence

No iPhone/Safari hardware, native iOS packaging, GPU benchmark, live Monad
attestation or contest deployment was tested. No player intervention in
the economic model is implemented. Camera routes and trade animation are
illustrative. The ordinary game's controls were preserved; its engine and
settlement scripts passed their existing checks, but its entire DOM flow
was not repeated in this browser session.
