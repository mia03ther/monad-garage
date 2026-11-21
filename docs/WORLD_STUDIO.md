# GENESIS World Observatory

This optional first-person prototype lives at `frontend/world.html`.
It is a new view over the existing civilization epoch, not a replacement
engine, an Obsidian plugin, or a full construction sandbox.

## Run and play

From a checkout of this feature branch, Windows PowerShell 5.1:

```powershell
py -3.12 -m http.server 8000 --bind 127.0.0.1 --directory frontend
```

Leave that terminal running; in a second terminal:

```powershell
Start-Process 'http://127.0.0.1:8000/world.html'
```

Any static HTTP host can serve `frontend/`. Do not open the HTML with
`file://`: ES module loading needs HTTP. Node/npm, Foundry and a wallet are
not required to play this view. Use a browser with WebGL 2 enabled.

1. On day zero, choose Aurora, Boreas, Cinder or Dune as your observation
   prediction. This marker has no stake, payout or effect on the result.
2. Use **走到 … 入口** to visit a campus, or **进入观测站** to start at the
   central ledger. **WASD** walks, **Shift** walks faster, **Space** jumps.
3. Mouse look can use pointer lock when the browser permits it. Otherwise
   hold and drag the scene; **←/→** turn and **↑/↓** walk. **Esc** releases
   the mouse. Aim at a resident or structure within eight units and press
   **E** to inspect. Inspections pause the simulation.
4. **＋ 一天** advances one day; **开始/继续演化** advances every 1.4 seconds;
   **看结局** finishes the 60-day epoch. All controls call the same engine.
5. Drag **回放日期** to reconstruct a day from its seed. This is a reset and
   deterministic replay, not reverse mutation of the current world.
6. Open **中央账本** (or inspect the central instrument), select **独立重算本局**,
   then **导出报告**. **重开** discards this local session and uses the seed
   input; it does not reset the original game's points or contact a wallet.

Small screens have directional buttons plus drag-to-look and **E 查看**.
Responsive browser testing is recorded separately from real device testing;
no native iOS app or App Store release is included.

## Code boundaries

- `studio/session.js`: validates parameters, owns four canonical worlds,
  advances daily steps, copies display snapshots, reconstructs replay and
  formats the final result/report.
- `studio/layout.js`: original spatial layout, bounded player motion,
  collision and camera input. No economic state is stored here.
- `studio/scene.js`: newly authored geometry, materials, ray selection and
  rendering. It consumes snapshots and cannot mutate engine inventories.
- `studio/app.js`: DOM controls, pause/reset behavior, keyboard/touch
  input, inspectors, errors and report download.
- `vendor/`: the pinned Three.js runtime and its upstream license.

`frontend/engine.js`, the Python simulation, SQLite save format, harness
and epoch settlement rules retain their behavior. Four civilizations use
five residents each; seed derivation and the 60-day scoring/digest rules
are exactly those of the existing epoch.

## What the scene means

The 20 visible residents correspond to engine resident IDs within each
civilization. Dead residents disappear. An inspector reads their exact
health, occupation, cash and resource inventories from the current day.
Resource stations show aggregate resident holdings, reference prices and
ledger production/consumption totals; they do **not** introduce warehouse
assets or additional production.

Walking routes are illustrations of occupation. They are not paths,
travel times or spatial constraints in the economic model. Markers along
resource-to-market routes illustrate actual current-day trade events,
capped at six per civilization; their movement/direction is schematic,
not the engine's buyer/seller positions or a complete transaction count.
Building height only distinguishes zero from nonzero aggregate stock.
The displayed totals and event records are authoritative for this view.

Camera, wall-clock time, animation, rendering quality and prediction do
not participate in the epoch digest. Reduced-motion preference freezes
ambient animation. The player cannot mint resources or alter residents
by walking, jumping, inspecting or editing the display snapshot.

## Verification and report

The incremental session's final result is compared field-for-field with
a fresh `runEpoch(params)` execution, including its canonical world and
epoch digests. This is a useful replay check against the shared reference
implementation, not an independent security audit or proof that the rules
model a real economy. Existing Python-generated golden fixtures also
check the shared browser engine.

The version-1 JSON report contains `format`, `version`, `mode`, `prediction`,
the complete canonical `result` (parameters, derived seeds, scores and
digests), optional `verification`, and `chain.submitted: false`.
No wall-clock timestamp, frame count, visual coordinates or device details
enter that deterministic report. Before day 60, export and verification
are unavailable. Rewind invalidates any previous verification.

The browser-exported, verified seed-42 example is in
[`examples/world-studio-42.report.json`](examples/world-studio-42.report.json).
Its epoch digest is:

```text
b25c8fb3e94f746bf4d29fd7118ecd0fb72b23b8386eda76b35830e00cfab9fc
```

This page sends no RPC, wallet or model requests. It neither anchors a
new result nor verifies that an existing on-chain anchor matches this
session. The original game's recorded Monad Testnet information remains
in its own interface and is not evidence that this browser session was
submitted. Anvil-local behavior is also separate from this page.

## Sixty-second judge walkthrough

Choose Cinder → visit its campus → advance a day → inspect its market with
E → fast-forward → open the ledger → independently recompute → export JSON.
Then rewind to day 20 and finish again: the seed-42 result stays the same.
The technical claim is a reproducible simulation with an explorable view.
It does not establish decentralization, hostile-code isolation, realistic
emergence or a competitive performance advantage for Monad.

## Next useful steps

First playtest whether inspecting a resident makes the outcome easier to
understand than the original dashboard. The remaining game-design gap is
meaningful player agency, not simply more buildings. A next experiment
could add one bounded resource-allocation decision with engine validation,
an action trace and new replay fixtures. That is deliberately not faked by
this visual prototype.

For a Monad integration, separate canonical report creation from optional
wallet-authorized attestation. Test that exact flow on Monad Testnet and
display confirmation failures and explorer evidence before claiming it
works. For human learning and future agent evaluation, keep scenario
criteria and grading in the existing harness rather than embedding them
in renderer callbacks. None of those future integrations are implemented
or required here.
