# GENESIS live interface system

This document is the visual contract for the Monad Blitz build. It exists so
later pages do not drift into unrelated game art or generic AI-generated SaaS
styling.

## Product metaphor

GENESIS looks like a live broadcast control system wrapped around a shared game
world. The world is the hero. Interface elements explain what the room can do,
what the contract confirmed, and what happens next.

It is not a crypto dashboard, a glass-card landing page, a fake operating
system, or a GTA imitation.

## Visual rules

- Near-black `#080808` is the stage; warm white `#f2efe7` is information.
- Monad purple `#836ef9` marks chain state and identity. It is not a page-wide
  gradient.
- Signal yellow `#f0ff66` appears only on the next executable action.
- Use square or 2–4 px corners, one-pixel rules, tabular numerals and compact
  uppercase labels. Avoid piles of floating rounded cards.
- The 3D world receives most of the screen. HUD text must remain legible at a
  distance and must never cover the primary phone action.
- Motion communicates state changes: a receipt arriving, a counter advancing,
  a module powering on. Decorative perpetual animation is avoided.

## Information hierarchy

1. **What is happening:** CITY ZERO is offline / online.
2. **What I can do:** one crew selection and one large contribution action.
3. **What the room proved:** confirmed actions, participants, countdown and
   measured confirmation timing.
4. **Technical detail:** transaction links, contract address and export remain
   available but never compete with the primary action.

## Required states

Every interactive change must check desktop, 390 px mobile, projector wall,
first-run briefing, waiting, pending, confirmed, failed, timed-out and completed
states. Practice, Anvil-local and Monad Testnet must remain visually distinct.

## Reference lessons, not copied assets

- AmongNad makes throughput readable with a single clock and links each human
  event to its transaction.
- Swarm keeps the phone focused on one repeatable action and gives the projector
  large truthful counters plus a live event stream.
- Infinite Gambit builds a distinct identity from one game metaphor rather than
  a collection of fashionable UI effects.
- Linux.do front-end discussions recommend a durable design file, mobile and
  error-state checks, and explicitly warn that default purple gradients,
  glassmorphism and oversized rounding often create an undifferentiated AI look.

No source code, artwork, map, copy, logo or branded asset from those projects is
incorporated into GENESIS.

Sources inspected on 2026-11-18:

- [AmongNad source](https://github.com/KaranSinghBisht/amongnad)
- [Swarm source](https://github.com/divyanshkhurana06/swarm)
- [Infinite Gambit source](https://github.com/wighawag/infinite-gambit)
- [Linux.do: front-end design workflow](https://linux.do/t/topic/2719422)
- [Linux.do: avoiding generic AI UI](https://linux.do/t/topic/804667)
- [Linux.do: interactive Three.js references](https://linux.do/t/topic/1151235)
