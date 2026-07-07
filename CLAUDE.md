# CLAUDE.md — project context for Claude Code

This file gives Claude Code the context it needs to work on this project
without re-explaining the structure every session.

## What this project is

**Wheel of Fate** — a standalone, offline Dota 2 hero + item randomizer.
Spin a celestial constellation dial → draw a random hero → get a skill build
→ roll a chaotic-but-legal item set (currently patch **7.41c**).

The entire app ships as **one self-contained HTML file**: `dist/index.html`
(~6.7 MB). No server, no internet, no build step needed to run it — just open
it in a browser.

## Repo layout

```
dist/index.html      ← the finished, runnable bundle (source of truth for RUNNING)
src/data.js          ← window.HEROES + item/skill data
src/app.js           ← the React app + constellation-dial UI (JSX / text-babel)
src/items-patch.js   ← the 7.41c item-roll rules
docs/ARCHITECTURE.md ← full explanation of the bundle format
```

`src/*` are **readable, extracted copies** of the parts of the bundle worth
editing. They exist for legible diffs — the running code lives inside the
base64 payload of `dist/index.html`.

## How the bundle works (important)

`dist/index.html` is produced by a bespoke exporter. Your code, React,
React-DOM, Babel, fonts, and two background PNGs are all **gzip+base64
embedded** inside `<script type="__bundler/manifest">` and
`<script type="__bundler/template">` tags. A runtime loader at the bottom of
the file decodes each resource into a Blob URL, rewrites the template to
point at those URLs, and swaps in the real document.

There is **no `package.json` / `npm run build`** that reproduces this bundle.
Do not try to invent one. Treat `dist/index.html` as the artifact.

## How to make a change (the workflow)

1. Edit the relevant file in `src/` first — that's the legible version.
2. Fold the same change into `dist/index.html`. The code sits inside the
   bundle's base64, so this is a mechanical decode → patch → re-embed:
   - Parse out the `__bundler/manifest` (JSON) and `__bundler/template`
     (a JSON-encoded HTML string) script tags.
   - For `src/data.js` / `src/app.js`: find the matching module in the
     manifest, gzip-decompress + base64-decode it, apply the edit, then
     re-compress and re-base64 it back into the manifest entry.
     - `src/data.js`  → manifest UUID `f5383b04-b7ad-450e-86cb-c9ee0a9f0a4f`
     - `src/app.js`   → manifest UUID `303b2e13-21c1-41c9-96d8-47cc58593564`
   - For `src/items-patch.js`: it's an **inline `<script>` inside the
     template string**, not a manifest module — edit it there.
   - When writing anything back into an HTML string, escape `</script>`,
     `</style>`, `</body>`, `</html>` as `<\/script>` etc. so tags don't
     terminate early. The existing file uses the `<\u002Fscript>` form.
3. Open `dist/index.html` in a browser and spin a few times to test.
4. Commit the `src/` change **and** the rebuilt `dist/index.html` together.

## Hard-won gotchas — do not regress these

- **Images must use CSS `background-image` on `<div>`s, never `<img>`.**
  The bundler installs a capture-phase `window` `error` listener; a failed
  `<img>` load (Steam CDN 404) fires a visible `[bundle] error` overlay. CSS
  background failures are silent. All hero portraits and item icons are divs.
- **Item slugs are Valve-internal names**, not display names. Known mappings:
  Khanda → `angels_demise`, Gleipnir → `gungir`, Parasma → `devastator`,
  Boots of Travel → `travel_boots_2`, Scythe of Vyse → `sheepstick`,
  Eul's Scepter → `cyclone`, Pipe of Insight → `pipe`. Verify a slug against
  dotaconstants before adding an item.
- **Script load order matters**: React → ReactDOM → Babel → your `text/babel`
  modules. Don't reorder the `<script>` tags in the template.
- **Skill-build grid uses real Dota leveling rules**: ultimate at 6/12/18;
  a skill point is awarded alongside the talent pick at 10/15/20/25.
- Hero/item art & metadata are fetched at runtime from OpenDota
  `dotaconstants` (canonical Valve image paths). Requires internet for the
  art specifically, but the app still runs offline (icons just won't load).

## Item-roll rules (current: 7.41c)

Each roll = 6 items, no duplicates:
- exactly **1 boots** (Phase / Power Treads / BoT / Boots of Bearing / Guardian Greaves)
- **0–1 blink** upgrade (Swift / Arcane / Overwhelming; 50%, never >1)
- remaining slots from a curated pool of final-form items > 2000 g across
  Accessories / Support / Magical / Armor / Weapons / Armaments
  (Essence Distiller kept as a deliberate sub-2000g exception)
- excluded: components, intermediates, neutrals, Aghanim's, Roshan drops

Full list + patch-7.41 rationale is in `src/items-patch.js`.
