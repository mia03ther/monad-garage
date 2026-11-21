# Island Lab: the Blitz demo

> Earlier single-player prototype. Current product entry and shared-room
> implementation: [RELAUNCH.md](RELAUNCH.md).

## Product and demo story

GENESIS Island Lab is a small community construction sandbox. Start with a
floating island and a core. Assemble a powered settlement, dismantle and
reconnect its infrastructure, then publish a reproducible blueprint that
another person can retrieve and rebuild. Reference: the general modular
assembly and responsive community ideas in 红魔社区. Geometry, layout,
economy, interaction and code in `frontend/sandbox/` are authored for
GENESIS; none of that plugin's code/assets is used. The separately licensed
Three.js runtime remains the only graphics dependency.

The stage story is **build → disconnect → reconnect → publish → rebuild on
another phone**. The first three steps work immediately without a wallet.
The chain stores the actual blueprint bytes as well as their digest and
first publisher, rather than recording a hash while leaving all content
on the developer's computer. This is the concrete reason to use a chain.
The current game does not demonstrate a need for parallel execution or a
performance advantage over other EVM chains. Do not claim otherwise.

## Play in 60 seconds

Open `/sandbox.html`, choose **观看建造演示**, or construct manually:
wind tower `(1,0)`, wood workshop `(-1,0)`, stone workshop `(0,-1)`, garden
`(0,1)`, homes `(1,1)` and `(-1,1)`, beacon `(1,-1)`. Advance three days.
The default solution has four residents, food 18, materials `[12,15,2]`
and power demand/supply `7/7`.

Press **X** and click the wind tower: materials are returned, most buildings
lose power, and occupancy drops. Choose the wind tower and rebuild it on
the same tile: the community responds immediately. Rotate a module with
**R**, use keys **1–7** or the toolbar to choose another kit. A right drag
or touch drag rotates the construction camera; desktop wheel zooms.
**进入岛内** switches to first-person visits: WASD, space and drag-look;
phones have a direction pad. Walking is illustrative and passes through
buildings; it is not a collision/survival game.

The game automatically saves locally. Save/load canonical JSON blueprints
or copy a URL containing the local blueprint. A local URL is labelled as
off-chain. An on-chain share URL contains the registry address and a
confirmed publication transaction; opening it reads the chain, verifies
the stored bytes and reconstructs the island.

## Local setup (Windows PowerShell 5.1)

From the repository root:

```powershell
py -3.12 -m http.server 8000 --bind 127.0.0.1 --directory frontend
```

In another terminal:

```powershell
Start-Process 'http://127.0.0.1:8000/sandbox.html'
```

No Node build, Foundry, backend API, model key or wallet is needed to play.
Do not use `file://`. HTTPS static hosting supports phone access and clipboard
sharing. QR target: `https://mia03ther.github.io/project-genesis/sandbox.html`.
QR generation used a development-only `npx --package qrcode` command; it is
not a runtime dependency. No new Python runtime dependency was added.

The demo was published to GitHub Pages from a dedicated `gh-pages` branch.
Public HTTP checks returned 200 with appropriate content types for the HTML,
application/model/scene modules, registry bytecode and Three.js runtime.
Local browser gameplay was verified; the browser automation connection
subsequently timed out while opening the public URL, including an inventory
request. Thus the public site has HTTP verification, not a completed public
browser or real-phone playtest. `main` was not merged or replaced.

## Blockchain implementation and limits

`contracts/GenesisBlueprints.sol` stores up to 8192 bytes per content digest.
`publish(bytes32,bytes)` requires the SHA-256 to match and rejects an existing
digest; `read(bytes32)` returns the bytes. It records the first publishing
address, not copyright, property rights, ownership of an island, or proof
that this person invented the design. It does not issue a token or move
funds. The contract checks content integrity, not game rules. The client
replays and validates the versioned action list.

The wallet gateway checks chain ID **10143**, contract runtime SHA-256
against the bundled tested build, successful receipt, target address,
publication ABI, content hash, historical contract storage and deterministic
replay. It never asks for a private key. A transaction hash alone is shown
as **pending**, not confirmed. Read-only retrieval uses the configured
Monad Testnet RPC. Node transport tests use a private loopback Anvil node
with chain ID 10143; equal chain IDs do not make it public Monad Testnet.

On the deployed website, **蓝图上链** has a one-time setup section that can
deploy the bundled registry bytecode through the user's wallet on Monad
Testnet. Alternatively, deploy the exact tested compiler build:

```powershell
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
forge test --root contracts --use 0.8.29 -vv
# Requires an already imported test-wallet account; prompts for its password.
forge create --root contracts --use 0.8.29 GenesisBlueprints.sol:GenesisBlueprints --rpc-url https://testnet-rpc.monad.xyz --account genesis-test --broadcast
```

Enter that contract address in the page, publish with a funded test wallet,
wait for confirmation and use **读取并验证蓝图**. Use the resulting share link
on another phone. Deployment and publication spend test MON as gas. No
public Monad transaction, public funded key or live wallet signing was
executed during development. **That final public-chain rehearsal remains
necessary before presenting this as a completed Monad integration.**

Official network reference:
[Monad Testnet docs](https://docs.monad.xyz/developer-essentials/testnet).
The supplied [Guangzhou event URL](https://luma.com/l07pbmke) could not be
retrieved by the research tool; scoring rules, eligibility of prebuilt work
and submission requirements have not been independently verified here.
The feature is a prototype to rehearse, not a claim of contest qualification
or guaranteed placement.

## Model and trust boundary

This is a separate, intentionally simplified construction model. It does
not rewrite the existing Python civilization engine or its browser port.
An integer grid, bounded material budget, exact cost/refund ledger,
deterministic grid-ordered power allocation and daily production make
assembly actions consequential. Occupancy is powered housing capacity
when food is available, not a full resident simulation. Crystal supply is
finite; day count is limited to 60 and traces to 240 actions. These limits
keep the demo small. Animation does not enter the blueprint or digest.

Modules conduct power through orthogonal neighbors back to the core;
disconnected wind towers add no supply. Producers only operate while
powered. Dismantling refunds construction cost, never previously produced
materials. Invalid actions fail without changing state. Imported files
are replayed and validated rather than trusted as inventory snapshots.
No untrusted JavaScript is executed. Browser local storage and unanchored
files can be edited by their owner; this is not a competitive anti-cheat
system or a sandbox for hostile code.

## Executed checks

Commands run from `D:\Github\project-genesis-studio`:

```powershell
node --test frontend/sandbox/verify.mjs
node --check frontend/sandbox/app.js
node --check frontend/sandbox/scene.js
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
forge test --root contracts -vv
node frontend/sandbox/anvil.mjs
& D:\Github\project-genesis\.venv\Scripts\python.exe -m pytest -q
& D:\Github\project-genesis\.venv\Scripts\python.exe -m mypy --strict genesis main.py
node --test frontend/studio/verify.mjs
```

Actual results: sandbox **7/7**, Solidity **2/2**, local Anvil deployment,
publication, historical storage read and exact reconstruction **passed**;
tampered digest rejected. Existing Python tests **635 passed in 33.72s**,
strict mypy **24 files clean**, previous scene checks **9/9**.
The first sandbox test had an incorrect hand-calculated expected budget;
correcting the arithmetic yielded the figures above without changing costs.

Browser validation on desktop and 390×844: actual demo completion, manual
wind-tower dismantle/rebuild, power and inventory changes, refresh/save
restoration, desktop WASD, phone direction controls and one-day production.
The browser warning/error log was empty at the check. Real iPhone hardware
and public wallet confirmation were not tested.

Evidence: [local-chain JSON](examples/island-anvil.report.json),
[actual browser-exported blueprint](examples/island-browser.blueprint.json),
[desktop screenshot](validation/island-desktop.jpg),
[phone-sized screenshot](validation/island-mobile.jpg).
