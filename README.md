# 🎡 Wheel of Fate — Dota 2 Champion's Lot

A standalone, offline hero + item randomizer for Dota 2. Spin a celestial
constellation dial to draw a random hero, get a suggested skill build, and
roll a chaotic-but-legal item set (patch **7.41c**).

The whole app is a single self-contained HTML file — no server, no build
step, no internet required to play. Just open it in a browser.

---

## ▶️ How to run it

Open **`dist/index.html`** in any modern browser (Chrome, Edge, Safari,
Firefox). That's it.

If you publish via GitHub Pages (see below), it's also playable at:
`https://<your-username>.github.io/wheel-of-fate/`

---

## 📁 What's in this repo

```
wheel-of-fate/
├── dist/
│   └── index.html      ← the finished, runnable app (open this to play)
├── src/                ← readable copies of the app's own code
│   ├── data.js         ← HEROES / ITEMS / SKILL_BUILDS roster
│   ├── app.js          ← the React app + constellation-dial UI
│   └── items-patch.js  ← the 7.41c item-roll rules (1 boots + 0–1 blink + others)
├── docs/               ← notes (see docs/ARCHITECTURE.md)
└── README.md
```

**`dist/index.html` is the source of truth for running the app.** It's a
bundle produced by a custom exporter: the app code, React, fonts, and
background images are all gzip/base64-embedded inside `<script type="__bundler/…">`
tags so the file works fully offline.

**`src/` holds clean, readable copies** of the parts of the app you'll
actually want to change. They're extracted from the bundle so you can read,
diff, and reason about them without wading through 6.7 MB of base64. See
`docs/ARCHITECTURE.md` for how they map back into the bundle.

---

## ✏️ Item-roll rules (current: 7.41c)

Each roll produces 6 items with no duplicates:

- **exactly 1 boots** — Phase, Power Treads, Boots of Travel, Boots of Bearing, or Guardian Greaves
- **0–1 blink upgrade** — Swift / Arcane / Overwhelming (50% chance, never more than one)
- **the rest** from a curated pool of final-form items > 2000 g across
  Accessories / Support / Magical / Armor / Weapons / Armaments
  (Essence Distiller kept as an intentional exception)

Excluded: components & intermediate items, neutrals, Aghanim's, Roshan drops.
Full rationale and the patch-7.41 corrections live in `src/items-patch.js`.

---

## 🎮 Credits

Hero/item art & metadata resolved at runtime from OpenDota `dotaconstants`
(Valve internal image paths). Not affiliated with Valve. For personal /
lobby use.
