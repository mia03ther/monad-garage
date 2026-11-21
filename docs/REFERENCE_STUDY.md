# Reference study: spatial data, original expression

## What was inspected

The user supplied `redmagic-world.zip`, an Obsidian plugin called **红魔社区**,
version **0.8.2**, manifest author **共创主义社会**. Inspection was read-only:
the manifest, file inventory and readable source sections in the bundled
JavaScript/HTML. The plugin was not installed or executed. Its private
configuration and DSH paths are neither imported nor published here.

The archive contains a manifest, `main.js`, standalone HTML, styles and
configuration. It does not contain an explicit license for the plugin's
own code/assets. The bundled Three.js license does not license the rest of
the plugin. No plugin implementation or asset has been added to GENESIS.

## Useful general principles

- Give data a spatial role: people, work sites and events should correspond
  to meaningful underlying entities, rather than decorative activity.
- Separate the simulation/data adapter, scene construction, selection and
  DOM interface. Rendering must not become the source of truth.
- Build a consistent family of modular structures from a small material
  palette; use selection to reveal detail rather than exposing every
  dashboard panel at once.
- Bound graphics cost. The reference has quality tiers; this prototype
  instead uses fixed low-detail geometry, a 1024px shadow map and a DPR cap.

These are common graphics/product techniques, not claims of invention.

## The GENESIS interpretation

The reference organizes a rotatable miniature around two landmasses and a
phone landmark with DSH/Obsidian data. GENESIS instead implements a
first-person **civilization observatory**: four economic campuses arranged
around a concentric ledger instrument. Farms, lumber workshops, stone
refineries, dwellings and markets have their own newly written geometry.
The scene depicts GENESIS's existing four-world epoch, not a phone or DSH
monitoring community.

The reference's logo, embedded photographs, textures, model builders,
layout coordinates, UI composition, character designs and text are not
reused. No package from the ZIP is a dependency. Our only graphics library
is an independently sourced, licensed Three.js distribution; its
provenance is recorded in `frontend/vendor/README.md`.

Originality comes from a distinct purpose, interaction, composition and
authored content; changing colors alone would not provide that distinction.
Violet is an accent alongside teal, copper and sage. This is GENESIS
branding, not an official Monad product or a copied Monad mascot.

## What makes this worth a hackathon demo

The product experiment is **enter → observe → verify**: meet the residents,
inspect what they hold, watch a day change, rewind the same experiment and
recompute its outcome. The existing deterministic engine supplies the
substance. A 3D scene by itself is not a new benchmark, a proof of fair
execution, or an on-chain game.

This branch tests that interaction without replacing the existing game.
It does not claim that this reference study establishes legal clearance,
contest eligibility, or community endorsement.
