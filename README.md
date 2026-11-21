# Project GENESIS

## GENESIS GARAGE · Monad 现场擂台

**接手擂主车，改一个零件，跑赢它。**

GENESIS GARAGE is a phone-first live challenge for Monad Blitz. The projector
shows the current champion, its challenge history, and one QR. A player scans,
changes the motor or tires, chooses where to spend one boost, and races the
champion's ghost. A faster direct challenger becomes the new champion; a loss
or an old fork remains in history without replacing it.

```powershell
py -3.12 -m http.server 8022 --bind 127.0.0.1 --directory frontend
```

Open `http://127.0.0.1:8022/garage.html`. Choose a part, challenge the champion, then tap
the boost button or press Space on the section where you want to use it. Share
the result to make it someone else's starting car. For a phone on a different
device, use a reachable deployment URL or serve `frontend` on a trusted LAN and
open the laptop's LAN address before generating the QR.

Use `http://127.0.0.1:8022/garage.html?wall=1` on the projector. The wall view
adds the current champion, recent challenge tree, and a phone entry QR. With a
configured Testnet registry, the QR always points at the current onchain champion.

### Walletless event mode

For the actual room, run the bounded relay instead of asking every phone to
install a wallet. It prompts once for the event operator's encrypted Foundry
keystore, serves the same frontend, and sponsors only validated calls to the
pinned Garage contract:

```powershell
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
Set-Location D:\Github\project-genesis
.\.venv\Scripts\python.exe -m genesis.garage_live `
  --host 0.0.0.0 --port 8040 --advertise-host 192.168.1.23
```

Open `http://127.0.0.1:8040/garage.html?wall=1` on the projector. Phones scan
the displayed LAN URL, play without a wallet, and submit through the operator's
low-balance Testnet-only account. Replace `192.168.1.23` with the laptop's LAN
IPv4 address. The relay enforces same-origin requests, sessions, rate limits,
idempotency, the current champion, parts budget, fixed contract, zero value and
one fixed method. It is event infrastructure, not a hostile-code sandbox and
must not be exposed directly to the public internet.

Keep the relay terminal open for the entire session. The projector may use the
printed loopback `wallUrl`; every audience QR uses the printed LAN `playerUrl`.
`127.0.0.1` is never a valid phone URL because it points back to the phone. If
automatic LAN detection selects a VPN adapter, restart with the real Wi-Fi IPv4:

```powershell
.\.venv\Scripts\python.exe -m genesis.garage_live --host 0.0.0.0 --port 8040 --advertise-host 192.168.1.23
```

The public build is connected to the verified Monad Testnet registry
`0xe1e1E8498ff909Bf1d2B8fD95ff849ec9C932c10`. Viewing and practicing are
wallet-free; submitting a challenger uses a test wallet and test MON only.

The optional Monad Testnet registry recomputes the simulated lap from the
submitted parts and boost section. It decides whether the car beat its parent
and whether it may replace the current champion. Every numbered car records its
driver and the car it modified, creating a public challenge tree. The browser
pins the expected registry bytecode and reads finalized records. See the
[Garage demo and verification guide](docs/GARAGE_DEMO.md).

## GENESIS LIVE · CITY ZERO

> **The crowd is the controller. The contract is the game engine.**

[Launch the experience](https://mia03ther.github.io/project-genesis/) · [Open CITY ZERO](https://mia03ther.github.io/project-genesis/play.html) · [Technical boundaries](docs/RELAUNCH.md)

**一句话定位：** GENESIS LIVE 是实时链上群众互动引擎。观众不再观看 Demo，而是扫码成为同一个可编程世界的玩家；合约执行规则，大屏呈现所有人的已确认行动。

**参赛体验：** CITY ZERO 是第一个旗舰任务。全场需要在 90 秒内分工恢复一座断电浮城，单人额度不足以独立通关。最终留下的不是一张截图，而是一份可验证的 **Proof of Coordination**。

GENESIS LIVE is an onchain live-experience engine. It turns an audience into players of one shared, programmable world. Instead of watching a product demo, people scan a code, join from their phones, and change the same state together while a public screen shows every confirmed contribution.

The first flagship experience is **CITY ZERO**: a neon floating district has lost power. The first confirmed action starts a 90-second mission. Players join POWER, HABITAT, or LIFELINE and contribute through one primary action instead of navigating a builder interface. At least three participants must coordinate a generator, two habitats, a bio-garden, and a signal beacon. No single player has enough build allowance to complete the mission alone.

The smart contract is not decorative storage. It is the authoritative game engine: it enforces the map, build allowance, ownership, power routing, deadline, and win condition. The result is a replayable **Proof of Coordination**.

## Why this belongs on Monad

Most blockchain products turn one wallet into one user interface. GENESIS turns a room into a live network.

- **Shared truth:** phones and the projector read the same confirmed world.
- **Composable rules:** the contract decides what can be built, powered, removed, and won.
- **Visible consequences:** every confirmed action changes a public 3D scene.
- **Portable participation:** a room is a contract address, not a private game-server database.
- **High-frequency potential:** fast confirmations make blockchain actions part of the play loop instead of a post-game receipt.

CITY ZERO is one scenario. The same engine can later support festival activations, community world-building, live competitions, public art, governance experiments, and human-versus-agent coordination trials.

## The 90-second demo

1. Put `play.html?wall=1` on the main screen.
2. Audience members scan the room QR code and join from their phones.
3. Players choose POWER, HABITAT, or LIFELINE; the first confirmed contribution starts the clock.
4. Each phone exposes one clear next move. Players divide the mission because one allowance cannot fund every objective.
5. The contract validates each action and the city lights up in real time.
6. Success unlocks free-build mode; timeout freezes the district as a final record.

The visual direction is an original neon-coastal techno-thriller: deep violet nights, electric magenta, coral highlights, cinematic mission copy, and Monad-purple energy. It does not use Grand Theft Auto names, characters, logos, maps, code, or artwork.

## Three execution modes

- **Practice:** static, untimed, and wallet-free. Local roles A/B/C teach the rules. They are simulated roles, not fake online users.
- **Anvil event rehearsal:** one laptop hosts a private local chain for up to nine phone sessions on a trusted LAN. Disposable accounts and synthetic funds only; no wallet installation is required.
- **Monad Testnet room:** a wallet deploys or joins a public room contract on chain ID `10143`. Viewing is wallet-free; building requires a test wallet and test MON.

The Anvil multiplayer path has been executed end to end. Public Monad wallet signing and physical iPhone testing are not yet claimed as verified.

## Run the public practice build

```powershell
git clone --branch codex/genesis-relaunch https://github.com/mia03ther/project-genesis.git genesis-live
Set-Location .\genesis-live
py -3.12 -m http.server 8000 --bind 127.0.0.1 --directory frontend
Start-Process 'http://127.0.0.1:8000/'
```

Choose a crew and use its large contribution button. The deterministic practice path is POWER once, HABITAT twice, and LIFELINE twice across roles A/B/C. Advanced Build Mode preserves manual placement; WASD/Space explores the district.

The competition positioning, exact stage flow, measurement rules, and remaining
Monad validation work are documented in [docs/MONAD_BLITZ_DEMO.md](docs/MONAD_BLITZ_DEMO.md).
The visual system and non-copying reference study are documented in
[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

## Run a local multiplayer room on Windows

Requirements: Python 3.12 and Foundry (`anvil`, `forge`, Solc 0.8.29).

```powershell
git clone --branch codex/genesis-relaunch https://github.com/mia03ther/project-genesis.git genesis-live
Set-Location .\genesis-live
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e '.[dev]'
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
.\.venv\Scripts\python.exe -m genesis.live --host 0.0.0.0 --port 8030
```

Open `http://127.0.0.1:8030/` on the host. Phones must use the laptop's LAN address, not `localhost`. If automatic address selection chooses a VPN or the wrong adapter, provide the actual IPv4 address:

```powershell
.\.venv\Scripts\python.exe -m genesis.live --host 0.0.0.0 --port 8030 --advertise-host 192.168.1.23
```

Open `/play.html?wall=1` on the projector. The first browser session is the local host and can start a new round. The service starts and owns a loopback-only Anvil process, deploys the contract, assigns disposable local accounts, and shuts the node down on `Ctrl+C`.

This development server is for a trusted local network. It does not configure Windows Firewall, bypass router client isolation, provide TLS, or form a hostile-code security boundary. Do not expose it directly to the public internet.

## Monad Testnet rehearsal

Use a dedicated test wallet and test MON only. From the public site, choose **Create Testnet Room**, approve deployment, and wait for runtime-code verification. Share the room QR code; each builder signs their own actions. The frontend waits for receipts before changing the authoritative scene.

The current testnet flow is not gasless. Never place wallet keys in the website, repository, logs, or screenshots. Anvil success does not prove Monad latency, wallet compatibility, or mobile reliability; run the checklist in [DEPLOY.md](DEPLOY.md) before a live event.

Contract source: [GenesisCommunity.sol](contracts/GenesisCommunity.sol). After a contract change, rebuild and export the pinned bytecode:

```powershell
forge build --root contracts --use 0.8.29
.\.venv\Scripts\python.exe tools/export_community.py
```

## Architecture

- `contracts/GenesisCommunity.sol` — authoritative grid, ownership, allowance, power routing, clock, and win state.
- `genesis/live.py` — owned Anvil lifecycle, disposable sessions, restricted action gateway, and static hosting.
- `frontend/community/domain.js` — deterministic practice model and scene adapter.
- `frontend/community/gateway.js` — strict ABI, chain/runtime checks, receipt tracking, logs, and transports.
- `frontend/community/app.js` — rooms, confirmations, QR invitations, recovery, projector mode, and feedback.
- `frontend/sandbox/scene.js` — original interactive 3D floating-district renderer.

The original deterministic civilization simulation, SQLite persistence, CLI, and Web3 learning harness remain intact. Their documentation is preserved in [docs/LEGACY_SIMULATION.md](docs/LEGACY_SIMULATION.md), and the earlier UI remains at `/legacy.html`.

## Verification

```powershell
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m mypy --strict genesis main.py tools/export_community.py
forge test --root contracts --use 0.8.29 -vv
node --test frontend/community/verify.mjs frontend/sandbox/verify.mjs frontend/studio/verify.mjs
$env:GENESIS_PYTHON = (Resolve-Path .\.venv\Scripts\python.exe).Path
node frontend/community/e2e.mjs
```

Recorded results for this relaunch:

- Python: **647 passed**
- Browser-domain Node tests: **29 passed**
- Solidity: **15 passed**
- Strict mypy: **28 source files clean**
- Three-session HTTP → gateway → Anvil experiment: passed, including shared state, ownership rejection, idempotency, power loss/recovery, timed completion, host-only reset, and stale-round rejection

Evidence: [machine-readable E2E report](docs/examples/relaunch-e2e.report.json) · [executed checks](docs/validation/RELAUNCH_CHECKS.md) · [deployment guide](DEPLOY.md)

GENESIS GARAGE was visually rehearsed in a desktop projector layout and a
390 × 844 phone viewport, including a complete winning run and QR handoff. This
is not a physical Mobile Safari or public Monad rehearsal; both remain mandatory
before the event.

## Scope and provenance

GENESIS does not issue a token, NFT, or real asset. Build allowance is a non-transferable game counter. Per-address limits are not proof of unique humans and do not solve Sybil resistance or long-term governance.

Three.js and the local MIT-licensed QR encoder are vendored with provenance in [frontend/vendor/README.md](frontend/vendor/README.md). No third-party game code, models, textures, characters, maps, or branded assets are copied. No paid AI API, Docker, Redis, or new database is required.
