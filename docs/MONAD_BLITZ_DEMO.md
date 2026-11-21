# GENESIS LIVE — Monad Blitz demo

## Product sentence

**A room of phones controls one onchain city in real time. Every confirmed
move is a Monad transaction.**

全场手机共同控制一座链上城市；每一次已确认操作，都是一笔 Monad 交易。

GENESIS is not a generic metaverse, a token project, or a city-building game.
It is a crowd-controlled onchain arcade engine. CITY ZERO is the first game
built on that engine.

## Why speed changes the game

The mission has a 90-second shared clock. Players join one of three crews:

- **POWER** starts the turbine.
- **HABITAT** brings two residential systems online.
- **LIFELINE** restores ecology and communications.

No single address has enough build credits to finish every objective. The
contract validates placement, credits, ownership, power routing, participation,
the deadline, and the win condition. The projector changes only after confirmed
receipts. Faster final feedback therefore changes whether a room can coordinate
under the clock; speed is part of the mechanic, not a logo on the page.

The interface reports actions confirmed by the current contract revision and
the browser session's measured median confirmation time. It must not display a
fabricated Monad latency. Practice mode is explicitly offchain, Anvil is
explicitly local, and Monad Testnet measurements are reported only after an
actual receipt.

## Ninety-second stage flow

1. Open `play.html?wall=1` on the projector and show the room QR code.
2. Three or more judges scan, choose a nickname, and join.
3. Ask them to spread across POWER, HABITAT, and LIFELINE.
4. The first confirmed action starts the 90-second contract clock.
5. Each phone has one primary contribution button. The projector shows the
   shared world, confirmed action count, contributors, and measured latency.
6. When the required powered systems and three participants are confirmed, the
   contract emits `IslandRestored` and the city changes state for everyone.
7. Export the machine-readable trace or open a transaction from the activity
   feed as evidence.

## Honest execution modes

- **Practice:** deterministic, wallet-free and offchain. It teaches the exact
  three-crew sequence but does not demonstrate Monad performance.
- **Anvil event rehearsal:** disposable synthetic accounts on a trusted LAN. It
  validates the multiplayer flow and contract rules, not Monad compatibility.
- **Monad Testnet:** public testnet transactions and measured confirmations.
  The current path requires a test wallet and test MON; gasless onboarding is a
  future event-hardening milestone, not a completed claim.

## Demo success criteria

- A new visitor understands their action in under ten seconds.
- At least three independent sessions affect the same contract state.
- The scene never changes optimistically before a receipt.
- Confirmed action count equals the contract revision shown by the client.
- Displayed latency comes from observed transaction timing in that browser.
- The final state can be reproduced from contract events and exported JSON.

## Next competition milestones

1. Deploy the current contract to Monad Testnet and record a full three-phone
   rehearsal with explorer links and measured latency distribution.
2. Add a narrowly scoped event relayer or session-key design so judges do not
   face a wallet approval for every action. Threat-model and rate-limit it
   before calling the flow gasless.
3. Add projector choreography: crew surges, brownout warnings, and a final
   proof card generated from confirmed events.
4. Test physical iPhones on the venue network and prepare a local Anvil fallback
   that is visibly labeled as a rehearsal.
