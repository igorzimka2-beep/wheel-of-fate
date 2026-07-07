# Architecture & how to edit

## The short version

`dist/index.html` is a **self-contained bundle**. Everything the app needs —
your code, React, React-DOM, the Babel transformer, web fonts, and the two
background images — is embedded inside the file as gzip+base64 payloads in
`<script type="__bundler/…">` tags. That's why it's ~6.7 MB and why it runs
with no server and no internet.

At load time a small runtime loader (a plain `<script>` at the bottom of the
file) decodes each embedded resource into a `Blob` URL, rewrites the page
template to point at those Blob URLs, and swaps in the real document. React
and Babel then run the app just like a normal page.

## What the `src/` files are

They are **extracted, readable copies** of the three parts of the bundle you
are likely to edit:

| file | role | where it lives in the bundle |
|------|------|------------------------------|
| `src/data.js` | `window.HEROES`, item/skill data | a gzip'd module inside the manifest |
| `src/app.js` | the React app + constellation-dial UI | a `text/babel` module inside the manifest |
| `src/items-patch.js` | 7.41c roll rules | an inline `<script>` inside the page template |

Keeping them in `src/` gives you clean git history and readable diffs. When
you change how the *app itself* works, edit here first so the change is
legible, then fold it into `dist/index.html`.

## Editing workflow (recommended)

Because re-bundling from scratch is fiddly, the pragmatic loop is:

1. **Prototype in `src/`.** Edit `src/app.js` / `src/data.js` /
   `src/items-patch.js`. This is where you and Claude Code do the real
   thinking — it's plain, readable JS.
2. **Fold the change into `dist/index.html`.** The app code sits inside the
   bundle's base64 payload, so you can't just paste over it by hand. Ask
   Claude (Code) to "apply the change in `src/app.js` to the bundle in
   `dist/index.html`" — decoding the relevant module, patching it, and
   re-embedding it with correct `<\/script>` escaping is exactly the kind of
   mechanical edit it handles well.
3. **Test.** Open `dist/index.html` in a browser and spin a few times.
4. **Commit** both the `src/` change and the rebuilt `dist/index.html`
   together, so they never drift apart.

## Why not a normal `npm run build`?

The bundle was produced by a bespoke exporter, not a standard toolchain, so
there's no `package.json` to reproduce it 1:1. Rebuilding by hand risks
subtle breakage (script ordering: React → ReactDOM → Babel → your `text/babel`
modules; `<\/script>` escaping; the capture-phase error sink that must not
trip on image 404s). Treating `dist/index.html` as the artifact and folding
edits into it — rather than regenerating it — is the low-risk path. If you
ever want a real build pipeline, that's a separate, larger project.

## Known gotchas (carried over from earlier work)

- **Images use CSS `background-image`, not `<img>`.** The bundler installs a
  capture-phase `error` listener; a failed `<img>` load fires a visible
  `[bundle] error`. CSS background failures are silent, so all portraits/item
  icons are `<div>`s with `background-image`.
- **Item slugs follow Valve internal names**, which don't always match the
  display name (e.g. Khanda → `angels_demise`, Gleipnir → `gungir`,
  Boots of Travel → `travel_boots_2`). Check `src/items-patch.js` before
  adding items.
- **Skill-build grid follows real Dota leveling rules**: ultimate at 6/12/18,
  a skill point alongside talents at 10/15/20/25.
