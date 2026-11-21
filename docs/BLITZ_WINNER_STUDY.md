# Monad Blitz research and GENESIS decision — 2026-11-18

> Research snapshot before the UI relaunch. Current integrated implementation
> and executed checks: [RELAUNCH.md](RELAUNCH.md). Remaining-work statements
> below describe the earlier research branch, not the new release.

## Decision

**GENESIS: scan, build together, restore a shared on-chain island.**

The audience gets a bounded contribution, chooses a module, and changes the
same world shown on the projector. The contract owns the shared board and
validates placement, allowance and dismantling permissions. Confirmed
actions have transaction links; pending actions must stay visibly pending.
The island is the interface to a small cooperative construction protocol.

The user has authorized a product pivot. Preserve the deterministic
civilization engine as an independent experiment; do not force its economy
into the live shared construction rules. Existing blueprints remain an
export/remix feature. The current public sandbox is still a local builder,
not the completed shared-world product described here.

## Primary-source findings

### The actual Guangzhou event

[Organizer event page](https://mojo.devnads.com/events/18) explicitly says
winners are chosen by the audience. Its listed November 21 schedule has
demos before discussion/voting. This makes immediate participation and a
clear observable outcome a reasonable product priority. That is our
inference, not an official scoring rubric. Rules about pre-existing work
were not established by the inspected page; don't present old work as
entirely written during the event.

### WICK: organizer-confirmed first place

A [Monad DevRel organizer's event account](https://portdeveloper.github.io/)
names WICK first at Ankara v3 (June 27, 2026), describing a market maker
that changes spread every block. The useful lesson is specificity: the
proposed financial mechanism is itself chain-dependent. No WICK code or
performance was independently tested here.

### Swarm: author-reported Blitz winner, inspected implementation

The [team repository](https://github.com/divyanshkhurana06/swarm) reports a
Hyderabad V3 win. The organizer's dynamic event page did not expose a
ranking to our reader, so award status remains author-reported here.

The [dashboard source](https://github.com/divyanshkhurana06/swarm/blob/main/web/app/dashboard/page.tsx)
reads contract counters and events for a projector view. The
[TaskPool source](https://github.com/divyanshkhurana06/swarm/blob/main/contracts/src/TaskPool.sol)
includes passkey authorization and internal earnings accounting followed
by withdrawal. Its current implementation should not be described as an
ERC20 transfer to a wallet on every answer. We borrow the interaction idea:
phone actions, shared screen, verifiable consequences. We did not run its
app, verify its deployment, or reuse its source.

### AmongNad: author-reported second place, inspected implementation

The [team repository](https://github.com/KaranSinghBisht/amongnad) reports
second at Pune. The
[core contract](https://github.com/KaranSinghBisht/amongnad/blob/main/contracts/src/AmongNad.sol)
distinguishes master-driven lifecycle/event logging from agent commit/reveal
voting. Its spectacle is understandable and its voting has a concrete
on-chain role. A chain log does not by itself prove every game event was
correct. No paid model calls, betting, game art or code are imported into
GENESIS from this project. Award status was not independently confirmed
against an organizer ranking.

### OpenRealm: confirmed nearby competitor, not a confirmed winner

[Official submission](https://mojo.devnads.com/projects/426) and
[public implementation](https://github.com/Oops-We-Built-It/OpenRealm)
already cover modular game collaboration, shared identity and revenue
distribution. Submission approval does not establish an award. A generic
“shared game universe” pitch would therefore give GENESIS little contrast
in this field. Our narrower demo is audience-operated, shared construction
with an immediate physical-looking effect.

These observations are patterns worth testing, not evidence explaining how
individual votes were cast or a recipe that guarantees a prize.

## What changes in the next demo

1. One QR code opens one shared room, rather than separate personal worlds.
2. Each accepted build changes the shared board after confirmation.
3. Occupied-cell races are resolved by the chain; browser optimism cannot
   overwrite the winner. Failed attempts do not consume build allowance.
4. The builder can reclaim their module's cost; someone else cannot remove
   it. The projector shows who contributed which module and links the tx.
5. The room reaches a visible cooperative objective. Resource production,
   power connectivity and victory validation must have a clearly defined
   authoritative implementation before claiming a full on-chain game.

The proposed 60-second story: show the empty island; invite the room to
scan; a person places a wind tower, another places housing, another grows
a garden; their contributions appear on the projector; inspect a real
receipt; reload a separate client and reconstruct the same shared board.
The demo needs several people visibly participating, not fake participant
counts or pre-recorded transactions presented as live.

## Implemented in this branch

`GenesisCommunity.sol` is an original prototype for the authoritative board:
81 indexed cells with a bounded island footprint, protected core, seven
module kinds, orthogonal adjacency, per-address one-time allowance of 12,
atomic build costs, builder-only dismantling, exact refunds, revision
numbers and contributor events. No token, payment, mint or treasury.

`contracts/test/Community.t.sol` adds six tests, including a 256-case fuzz
test. Together with the two blueprint tests, `forge test --root contracts
-vv` passed **8/8**. Tests include occupied-cell rejection, unauthorized
removal, allowance exhaustion, invalid coordinates/rotation, protected core,
three builders and exact refund accounting.

`frontend/sandbox/community-anvil.mjs` deployed the contract on a private
loopback Anvil node, sent actual transactions from three separate test
accounts, read one fixed block through all three clients, and asserted
identical state and correct builders. It also checked rejection of duplicate
placement and another builder's dismantling. It passed; evidence is in
[`examples/community-anvil.report.json`](examples/community-anvil.report.json).
Matching the Testnet chain ID in a local node does not make this a public
Monad Testnet test.

Executed commands (Foundry 1.8.7, Node 24.19.0):

```powershell
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
forge test --root contracts -vv
node frontend/sandbox/community-anvil.mjs
```

No third-party project was cloned into GENESIS or executed. Public source
was inspected as research. Any future reuse needs the applicable license
and attribution; public visibility alone does not grant reuse permission.

## Remaining work, in order

The new contract is **not yet wired to the public builder UI**. The current
Pages demo has not become multiplayer merely because these tests passed.

First connect a projector/client to the same contract snapshot, with
chain-ID/address validation, confirmation status, error recovery and
revision-aware refresh. Then connect submission through authenticated
players. Per-click wallet prompts are a serious adoption problem; a
bounded sponsored/session-authorized flow needs explicit design and tests,
not a simulated “gasless” label. No sponsor key, relayer or session wallet
exists in this branch.

Per-address allowance is not one-human-one-allowance: a person can create
multiple addresses. Adjacency is not a guarantee of continued connection
to the core after removal. The contract does not yet enforce electricity,
production or a win condition. These are prototype limits, not solved
anti-abuse or game-economy claims.

Finally execute the deployed public Monad flow with separate phone clients,
measure observed confirmation times, and rehearse failure/reload paths.
Do not invent a throughput comparison or claim Monad-specific speed from
Anvil measurements. The existing public contract deployment gap remains.
