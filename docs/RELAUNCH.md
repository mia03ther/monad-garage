# GENESIS relaunch — 2026-11-18

## Product

GENESIS is now a 90-second cooperative construction game: several people change the
same island, and a projector shows their confirmed contributions. A tiny
budget makes collaboration necessary. One address cannot afford the entire
objective; completion also requires three contributing addresses. A wind
tower, two homes, a garden and a beacon must be powered together. Losing
the source changes the authoritative goal; restoring it recovers the island.

This is a short playable prototype, not validated product-market fit or
evidence of likely hackathon placement. The useful test is whether strangers
can understand the task and enjoy coordinating their contributions. The
remaining game-design gap is sustained challenge after the first success.

The original civilization engine, its CLI, SQLite formats, browser port
and scenario harness stay intact. Their old website lives at `legacy.html`.
The earlier individual builder remains `sandbox.html`; the active product
entry points are `index.html`, `play.html` and `play.html?wall=1`.

## Three modes, explicitly separated

**Practice** works from any static host. Roles A/B/C are local simulated
roles, not fabricated online users. Its action trace is stored in the
browser and can be exported. Tabs on the same origin may share this local
practice through storage events; that is not remote multiplayer.

**Local event rehearsal** runs `python -m genesis.live`. It starts an owned,
loopback-only Anvil node with chain ID **31337**, compiles and deploys the
room contract, serves the frontend and a bounded HTTP gateway. Up to nine
browser sessions receive different disposable test accounts. The server
pays only synthetic local gas. Phones on a trusted LAN can use the room
without installing wallets. The webpage and projector say Anvil-local.
The host controls these local accounts; this mode is not self-custody.

**Monad Testnet rooms** are static-host compatible. An injected wallet
deploys the bundled contract after explicit user confirmation, or joins a
known contract address. An invite contains the shared contract address;
the projector and players read the same pinned block. Viewing is wallet-free;
building requires the player's test wallet and test MON. No gas-sponsored
public relay, passkey onboarding, mainnet or real-money economy is implemented.

The shared-world flow was executed on local Anvil, not public Monad.
The public wallet deployment/confirmation and real-phone network rehearsal
still need to be executed before describing the public-chain demo as proven.

## Authority and state

The first confirmed build starts the 90-second chain-time window. Completion
is recorded atomically when either a build or removal achieves the goal;
removing excess load can be a valid strategic move. Completed rooms unlock
free building. An incomplete room becomes read-only at the deadline. The
display interpolates a countdown between pinned chain reads, but shows
"waiting for confirmation" at zero until the contract reports timeout.
Practice is explicitly untimed. Local Anvil mines every second for the
countdown. No claim about public Monad latency is derived from that setting.

In the local rehearsal, the first session is the host and can deploy a new
round from the room menu. Sessions retain their identities. Other clients
detect the changed room instance and reload; stale-instance actions are
rejected, including requests queued across a reset. This host privilege is
for trusted local rehearsal, not permissionless public governance.

`GenesisCommunity.sol` validates grid bounds, kind, orientation, adjacency,
occupied cells, a one-time allowance of 12 per contributing address, cost,
builder-only removal and exact refunds. It returns the full board and a
bounded traversal of power connectivity. Consumers are powered in public
cell-index order under insufficient supply. The contract computes powered
housing/gardens/beacons and whether the cooperative objective is met.

The renderer receives confirmed snapshots. It does not optimistically add
unconfirmed modules. Receipt failures retain authoritative balances. Browser
reloads can resume tracking a returned pending transaction hash. Local
network retries reuse one idempotency key; conflicting payloads are rejected.
Wallet submission is not automatically retried when its outcome is unknown.
An interrupted local signing RPC before a hash is returned is not a general
exactly-once guarantee; state constraints still reject occupied placement
and repeated removal. Successful HTTP acknowledgements are cached for retry.

The event feed comes from contract logs, with explorer links in public mode.
Contributing addresses are not proof of distinct humans or active viewers.
Per-address allowance does not solve Sybil attacks. This is not a production
anti-griefing, access-control or hostile-code sandbox system.

## Local gateway boundary

The gateway cannot be configured with a public signing RPC. It creates its
own private Anvil process and exposes only fixed-target reads plus validated
build/removal submissions. It rejects arbitrary signing methods, external
read targets, cross-origin mutations, oversized bodies and excess requests.
Session cookies are HttpOnly/SameSite=Strict. Signing is limited to nine
owned test accounts, 4096 acknowledged operations and contract allowances.
The node itself stays bound to loopback even when the website binds to LAN.

Do not expose this development HTTP server directly to the Internet. It
does not implement production TLS, account recovery, durable session storage
or human identity. Restarting creates a new ephemeral local world. Export
records before restarting if evidence matters. Public room state remains
on its public contract independently of the static website.

## Implementation map

- `genesis/live.py`: owned local chain lifecycle, bounded session gateway,
  same-origin HTTP rules and static frontend serving; standard library only.
- `frontend/community/domain.js`: transparent practice model, coordinate
  rules and renderer adapter; same power allocation as the contract.
- `frontend/community/gateway.js`: strict ABI parsing, network/runtime-code
  checks, fixed-block reads, receipts, event decoding and transport adapters.
- `frontend/community/app.js`: room/practice selection, joining, confirmation,
  recovery, QR invitations, projector and contribution feedback.
- `frontend/community/landing.*`: the new product entry.
- `frontend/sandbox/scene.js`: original procedural island, touch/keyboard
  input, building selection, contributor accent colors and placement reveal.
- `tools/export_community.py`: exports the compiled creation bytecode and
  pinned runtime hash. A changed contract must be rebuilt and re-exported.

Three.js and the MIT-licensed QR encoder are vendored with provenance.
Invitations are encoded locally; URLs are not sent to a QR image service.
No paid model calls, new tokens, NFTs, containers or databases are introduced.

## Validation boundaries

The new HTTP end-to-end experiment uses three independent cookie jars and
three actual Anvil accounts. It builds the goal, verifies all readers agree,
checks identical retry hashes, rejects foreign removal/occupied cells,
rejects cross-origin and arbitrary-signing requests, then verifies real power
loss/recovery and seven contract events. Evidence:
[`examples/relaunch-e2e.report.json`](examples/relaunch-e2e.report.json).

Browser/native UI automation was attempted through both available runtimes.
Both failed before interacting with the app, reporting a missing kernel-assets
path. Therefore no new browser screenshot, WebGL render, wallet signing,
mobile Safari or real-phone test is claimed in this relaunch. Static DOM
wiring checks and HTTP/chain E2E tests are useful but do not replace these.
Old screenshots in `docs/validation/` belong to the earlier prototypes.

See `validation/RELAUNCH_CHECKS.md` for final commands and measured results.
