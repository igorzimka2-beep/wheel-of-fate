// ============ Wheel of Fate — App ============
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ============ Image lookups (Steam CDN via dotaconstants) ============
const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";
const HERO_DATA_URL = "https://cdn.jsdelivr.net/npm/dotaconstants@latest/build/heroes.json";
const ITEM_DATA_URL = "https://cdn.jsdelivr.net/npm/dotaconstants@latest/build/items.json";

const heroImageMap = {};
const itemImageMap = {};
const heroPortraitMap = {}; // full vertical portrait for hero reveal

function slugGuess(name) {
  return name.toLowerCase().replace(/['']/g, "").replace(/[-\s]+/g, "_");
}

// Some display names don't match dotaconstants' localized names. Outworld
// Destroyer, for example, is keyed as "Outworld Devourer" and its Steam-CDN
// slug is "obsidian_destroyer" — slugGuess would produce "outworld_destroyer"
// which 404s. These overrides force the canonical slug.
const HERO_SLUG_OVERRIDE = {
  "Outworld Destroyer": "obsidian_destroyer",
};
function heroSlug(name) {
  return HERO_SLUG_OVERRIDE[name] || slugGuess(name);
}
// window.ITEM_SLUGS (set by the host page) holds canonical item slugs for the
// curated pool — used only when dotaconstants lacks the item by display name
// (e.g. "Eul's Scepter" → cyclone).
function itemSlug(name) {
  return (window.ITEM_SLUGS && window.ITEM_SLUGS[name]) || slugGuess(name);
}

function heroImg(name) {
  return heroImageMap[name] || `${STEAM_CDN}/apps/dota2/images/dota_react/heroes/${heroSlug(name)}.png`;
}
function heroPortrait(name) {
  // Full-body "render" is best for the reveal card. When dotaconstants lacks
  // the hero, fall back to the render slug — not the small horizontal icon.
  return heroPortraitMap[name] ||
    `${STEAM_CDN}/apps/dota2/videos/dota_react/heroes/renders/${heroSlug(name)}.png`;
}
function itemImg(name) {
  return itemImageMap[name] || `${STEAM_CDN}/apps/dota2/images/dota_react/items/${itemSlug(name)}.png`;
}

const imageDataPromise = (async () => {
  try {
    const [hRes, iRes] = await Promise.all([fetch(HERO_DATA_URL), fetch(ITEM_DATA_URL)]);
    if (!hRes.ok || !iRes.ok) throw new Error("HTTP");
    const [heroes, items] = await Promise.all([hRes.json(), iRes.json()]);
    Object.values(heroes).forEach(h => {
      if (!h.localized_name) return;
      // h.name is "npc_dota_hero_anti_mage" → slug
      const slug = (h.name || '').replace(/^npc_dota_hero_/, '');
      if (h.img) heroImageMap[h.localized_name] = STEAM_CDN + h.img.replace(/\?$/, "");
      if (slug) heroPortraitMap[h.localized_name] =
        `${STEAM_CDN}/apps/dota2/videos/dota_react/heroes/renders/${slug}.png`;
    });
    Object.values(items).forEach(it => {
      if (it.dname && it.img) itemImageMap[it.dname] = STEAM_CDN + it.img.replace(/\?$/, "");
    });
  } catch (err) {
    console.warn("dotaconstants fetch failed, falling back to slug guessing.", err);
  }
})();

// ============ Helpers ============
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function pickN(arr, n) {
  const c = arr.slice(), out = [];
  for (let i = 0; i < n && c.length; i++) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
  return out;
}
const initials = name => name.split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

// Cap how many heroes appear on the wheel at once. With >16 heroes the orbit
// gets crowded — we randomly sample 16 (the chosen hero is always guaranteed
// to be in the sample on each spin).
const MAX_WHEEL = 16;

// Build a wheel sample. If chosen is given, it's guaranteed in the result.
function buildWheelSample(pool, chosen) {
  if (pool.length <= MAX_WHEEL) {
    return pickN(pool, pool.length);
  }
  if (chosen) {
    const others = pickN(pool.filter(h => h !== chosen), MAX_WHEEL - 1);
    // Shuffle chosen into a random position so it isn't always at idx 0
    const out = [...others];
    out.splice(Math.floor(Math.random() * (out.length + 1)), 0, chosen);
    return out;
  }
  return pickN(pool, MAX_WHEEL);
}

const ATTR_DIM = { str: "#4a1a32", agi: "#1a3a30", int: "#1a2e50", uni: "#38205a" };
const ATTR_BRIGHT = { str: "#e8629a", agi: "#5ad6b0", int: "#6ab8ff", uni: "#c088ff" };

// Hanging lanterns — clustered along the sides, never over the centred wheel.
const LANTERNS = [
  { x: 4.5, len: 70,  size: 34, delay: -0.4, dur: 7.5 },
  { x: 10,  len: 150, size: 26, delay: -2.1, dur: 6.2 },
  { x: 16,  len: 250, size: 38, delay: -3.6, dur: 8.4 },
  { x: 7,   len: 360, size: 22, delay: -1.2, dur: 7.0 },
  { x: 84,  len: 250, size: 38, delay: -2.8, dur: 8.0 },
  { x: 90,  len: 150, size: 26, delay: -0.9, dur: 6.6 },
  { x: 95.5,len: 70,  size: 32, delay: -4.1, dur: 7.8 },
  { x: 93,  len: 360, size: 22, delay: -1.8, dur: 7.2 },
];

// ============ Parallax Scene (Cosmic — Hamburg) ============
function Scene({ bg, grade }) {
  // Stars: distributed across the sky (top 75% of viewport), in depth layers
  // with subtle colour variation so the field reads as real, not a dot grid.
  const stars = useMemo(() => {
    const arr = [];
    const tints = [
      'rgba(255,255,255,1)',   // white
      'rgba(255,255,255,1)',
      'rgba(216,228,255,1)',   // cool blue-white
      'rgba(236,216,255,1)',   // lavender
      'rgba(255,236,216,1)',   // warm
    ];
    for (let i = 0; i < 340; i++) {
      const r = Math.random();
      const big = r < 0.05;
      const mid = !big && r < 0.22;
      const tint = tints[Math.floor(Math.random() * tints.length)];
      arr.push({
        left: Math.random() * 100,
        top: Math.random() * 76,
        size: big ? 2.4 + Math.random() * 1.8 : mid ? 1.2 + Math.random() * 1.0 : 0.5 + Math.random() * 0.9,
        opacity: big ? 0.85 + Math.random() * 0.15 : mid ? 0.5 + Math.random() * 0.4 : 0.25 + Math.random() * 0.45,
        dur: 2 + Math.random() * 6,
        delay: -Math.random() * 8,
        glow: big,
        color: tint,
      });
    }
    return arr;
  }, []);

  // Milky Way: a dense diagonal river of faint stars across the upper sky.
  const milkyWay = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 220; i++) {
      // Parametric band from upper-left to mid-right, with gaussian spread.
      const t = Math.random();
      const cx = 12 + t * 78;            // travels left → right
      const cy = 8 + t * 34;             // gently descends
      const spread = (Math.random() + Math.random() - 1) * 11; // ~gaussian
      arr.push({
        left: cx + spread,
        top: cy + spread * 0.5,
        size: 0.4 + Math.random() * 1.1,
        opacity: 0.18 + Math.random() * 0.4,
        dur: 3 + Math.random() * 6,
        delay: -Math.random() * 9,
      });
    }
    return arr;
  }, []);

  // Constellation polylines — a few connected star clusters
  const constellations = useMemo(() => {
    const seed = (n) => (Math.sin(n * 12.9898) * 43758.5453) % 1;
    const lines = [];
    for (let c = 0; c < 5; c++) {
      const pts = [];
      let x = 10 + seed(c * 7 + 3) * 80;
      let y = 5 + seed(c * 11 + 5) * 45;
      pts.push([x, y]);
      const len = 3 + Math.floor(Math.abs(seed(c * 13)) * 4);
      for (let i = 0; i < len; i++) {
        x += (seed(c * 17 + i) - 0.3) * 16;
        y += (seed(c * 19 + i) - 0.3) * 12;
        x = Math.max(2, Math.min(98, x));
        y = Math.max(2, Math.min(65, y));
        pts.push([x, y]);
      }
      lines.push(pts);
    }
    return lines;
  }, []);

  // Cosmic dust motes drifting upward from below
  const motes = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 20; i++) {
      arr.push({
        left: Math.random() * 100,
        top: 70 + Math.random() * 30,
        size: 2 + Math.random() * 4,
        dur: 16 + Math.random() * 18,
        delay: -Math.random() * 30,
        opacity: 0.4 + Math.random() * 0.5,
      });
    }
    return arr;
  }, []);

  // Shooting stars (random positions, sparse)
  const shootingStars = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => ({
      left: 10 + Math.random() * 60,
      top: 5 + Math.random() * 30,
      delay: i * 7 + Math.random() * 4,
    }));
  }, []);

  return (
    <div className={`scene bg-${bg || 'drawn'} grade-${grade || 'strong'}`} aria-hidden="true">
      {/* Photographic SKY layer — user drops a nebula / starfield / cosmic photo */}
      <div className="photo-sky">
        <image-slot id="bg-sky" shape="rect" src={(window.__resources && window.__resources.bgSky) || 'assets/bg-sky.png'} placeholder="Drop a sky / nebula photo"></image-slot>
        <div className="photo-grade sky-grade"></div>
      </div>

      <div className="scene-far" />

      <div className="milkyway" aria-hidden="true">
        {milkyWay.map((s, i) => (
          <span key={i} className="star" style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }} />
        ))}
      </div>

      <div className="stars">
        {stars.map((s, i) => (
          <span key={i} className="star" style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            background: s.color,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
            boxShadow: s.glow ? `0 0 6px ${s.color}, 0 0 12px rgba(192,98,255,0.5)` : 'none',
          }} />
        ))}
        {shootingStars.map((s, i) => (
          <span key={`ss-${i}`} className="shooting-star" style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            animationDelay: `${s.delay}s`,
          }} />
        ))}
      </div>

      <svg className="constellations" viewBox="0 0 100 70" preserveAspectRatio="none"
           xmlns="http://www.w3.org/2000/svg">
        {constellations.map((pts, ci) => (
          <g key={ci}>
            <polyline points={pts.map(p => p.join(',')).join(' ')}
                      fill="none" stroke="rgba(232, 216, 255, 0.22)" strokeWidth="0.08" />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="0.18"
                      fill="rgba(255,255,255,0.95)"
                      style={{ filter: 'drop-shadow(0 0 1px rgba(232,168,255,0.9))' }} />
            ))}
          </g>
        ))}
      </svg>

      <div className="aurora" />

      <div className="clouds">
        <svg viewBox="0 0 1200 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(232, 216, 255, 0.35)" />
              <stop offset="0.5" stopColor="rgba(160, 130, 220, 0.55)" />
              <stop offset="1" stopColor="rgba(60, 36, 120, 0.85)" />
            </linearGradient>
          </defs>
          {/* Layered cloud shapes — softly blobbed */}
          <path d="M0 120 Q 60 95 120 110 T 240 105 T 360 115 T 480 100 T 600 110 T 720 100 T 840 115 T 960 105 T 1080 115 T 1200 110 L 1200 200 L 0 200 Z"
                fill="url(#cloudGrad)" opacity="0.85" />
          <path d="M0 145 Q 80 120 160 130 T 320 130 T 480 125 T 640 135 T 800 125 T 960 132 T 1120 128 T 1200 135 L 1200 200 L 0 200 Z"
                fill="url(#cloudGrad)" opacity="0.7" />
          <path d="M0 170 Q 100 155 200 162 T 400 162 T 600 158 T 800 165 T 1000 160 T 1200 165 L 1200 200 L 0 200 Z"
                fill="rgba(180, 150, 230, 0.6)" />
        </svg>
      </div>

      <div className="mountains">
        <svg viewBox="0 0 1200 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="mtnHaze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(150,130,210,0.55)" />
              <stop offset="1" stopColor="rgba(90,70,150,0.10)" />
            </linearGradient>
            <linearGradient id="mtnFar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5b4a92" />
              <stop offset="1" stopColor="#2a1f58" />
            </linearGradient>
            <linearGradient id="mtnMid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a2a6e" />
              <stop offset="1" stopColor="#160a38" />
            </linearGradient>
            <linearGradient id="mtnFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#221550" />
              <stop offset="1" stopColor="#07041a" />
            </linearGradient>
            <linearGradient id="snowCap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(244, 230, 255, 0.98)" />
              <stop offset="1" stopColor="rgba(170, 140, 225, 0.35)" />
            </linearGradient>
            <linearGradient id="snowShade" x1="0" y1="0" x2="1" y2="0.5">
              <stop offset="0" stopColor="rgba(120, 96, 180, 0.7)" />
              <stop offset="1" stopColor="rgba(80, 60, 130, 0.25)" />
            </linearGradient>
            <linearGradient id="hazeBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgba(180,156,236,0.0)" />
              <stop offset="0.55" stopColor="rgba(170,146,226,0.22)" />
              <stop offset="1" stopColor="rgba(120,96,190,0.0)" />
            </linearGradient>
          </defs>

          {/* Farthest haze ridge — barely-there silhouette */}
          <path d="M0 96 L 70 78 L 150 90 L 230 64 L 310 86 L 400 70 L 500 88 L 590 72 L 690 90 L 780 74 L 880 88 L 980 70 L 1090 86 L 1200 76 L 1200 220 L 0 220 Z"
                fill="url(#mtnHaze)" opacity="0.7" />

          {/* Atmospheric haze band sitting in front of the far ridge */}
          <rect x="0" y="92" width="1200" height="52" fill="url(#hazeBand)" />

          {/* Back range */}
          <path d="M0 120 L 60 92 L 96 104 L 165 66 L 210 96 L 268 74 L 320 100 L 392 60 L 452 98 L 512 78 L 575 104 L 648 68 L 712 100 L 778 80 L 845 104 L 918 66 L 980 98 L 1052 80 L 1118 104 L 1175 84 L 1200 96 L 1200 220 L 0 220 Z"
                fill="url(#mtnFar)" opacity="0.92" />

          {/* Haze band between back and mid ranges */}
          <rect x="0" y="118" width="1200" height="46" fill="url(#hazeBand)" opacity="0.8" />

          {/* Mid range — sharper, taller */}
          <path d="M0 150 L 64 112 L 92 128 L 150 86 L 200 124 L 252 100 L 312 132 L 372 78 L 430 126 L 492 96 L 548 134 L 612 86 L 676 128 L 740 104 L 800 136 L 862 84 L 922 128 L 988 102 L 1050 134 L 1116 96 L 1170 126 L 1200 112 L 1200 220 L 0 220 Z"
                fill="url(#mtnMid)" />

          {/* Mid-range snow caps with shadowed flanks */}
          <path d="M362 92 L 372 78 L 384 92 Z" fill="url(#snowCap)" opacity="0.9" />
          <path d="M372 78 L 384 92 L 379 96 L 372 86 Z" fill="url(#snowShade)" opacity="0.7" />
          <path d="M852 98 L 862 84 L 874 98 Z" fill="url(#snowCap)" opacity="0.9" />
          <path d="M862 84 L 874 98 L 869 102 L 862 92 Z" fill="url(#snowShade)" opacity="0.7" />

          {/* Front range — darkest, most jagged, foreground silhouette */}
          <path d="M0 200 L 50 150 L 78 170 L 132 110 L 178 158 L 230 124 L 286 162 L 344 96 L 398 156 L 452 120 L 508 164 L 568 104 L 624 158 L 686 126 L 742 168 L 800 110 L 856 160 L 912 130 L 968 166 L 1028 112 L 1086 158 L 1142 134 L 1200 162 L 1200 220 L 0 220 Z"
                fill="url(#mtnFront)" />

          {/* Front-range ridge rim-light catching the wheel's glow */}
          <path d="M132 110 L 178 158 M344 96 L 398 156 M568 104 L 624 158 M800 110 L 856 160 M1028 112 L 1086 158"
                fill="none" stroke="rgba(192,98,255,0.28)" strokeWidth="1.2" />

          {/* Front-range snow caps */}
          <path d="M124 122 L 132 110 L 141 123 Z" fill="url(#snowCap)" opacity="0.95" />
          <path d="M336 108 L 344 96 L 353 109 Z" fill="url(#snowCap)" opacity="0.95" />
          <path d="M560 116 L 568 104 L 577 117 Z" fill="url(#snowCap)" opacity="0.95" />
          <path d="M792 122 L 800 110 L 809 123 Z" fill="url(#snowCap)" opacity="0.95" />
          <path d="M1020 124 L 1028 112 L 1037 125 Z" fill="url(#snowCap)" opacity="0.95" />
        </svg>
      </div>

      {/* Photographic MOUNTAIN / valley layer — own parallax band */}
      <div className="photo-mountains">
        <image-slot id="bg-mountains" shape="rect" src={(window.__resources && window.__resources.bgMountains) || 'assets/bg-mountains.png'} placeholder="Drop a mountain / misty valley photo"></image-slot>
        <div className="photo-grade mtn-grade"></div>
      </div>

      <div className="scene-near">
        {motes.map((m, i) => (
          <span key={i} className="mote" style={{
            left: `${m.left}%`,
            top: `${m.top}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            opacity: m.opacity,
            animationDuration: `${m.dur}s`,
            animationDelay: `${m.delay}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ============ Atmosphere (mist / fog layers) ============
// Slow-drifting blurred fog banks that sit behind the UI (z-index 1) and add
// mysterious depth. Mode controlled by the `atmosphere` Tweak.
function Atmosphere({ mode }) {
  if (!mode || mode === 'none') return null;
  const count = mode === 'veil' ? 4 : 3;
  return (
    <div className={`atmosphere atm-${mode}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`fog fog-${i + 1}`} />
      ))}
    </div>
  );
}

// ============ Foreground Framing (subtle scene enrichment) ============
// Renders all three framing styles; the active one is revealed via the
// `fg-<style>` class on the root so it can be toggled instantly (Tweak / test).
// Lives OUTSIDE .app (fixed, z-index 1) so it frames the edges without ever
// covering the centred wheel, and isn't clipped by .app's shake transform.
function Foreground({ framing }) {
  return (
    <div className={`foreground fg-${framing || 'pillars'}`} aria-hidden="true">
      <div className="fg-pillars">
        <div className="fg-pillar far left">
          <span className="fg-pillar-cap" />
          <span className="fg-pillar-shaft" />
          <span className="fg-pillar-base" />
        </div>
        <div className="fg-pillar far right">
          <span className="fg-pillar-cap" />
          <span className="fg-pillar-shaft" />
          <span className="fg-pillar-base" />
        </div>
        <div className="fg-pillar left">
          <span className="fg-pillar-cap" />
          <span className="fg-pillar-shaft">
            {[0,1,2,3,4,5].map(i => <span key={i} className="fg-rune" style={{ top: `${12 + i*14}%` }} />)}
          </span>
          <span className="fg-pillar-base" />
        </div>
        <div className="fg-pillar right">
          <span className="fg-pillar-cap" />
          <span className="fg-pillar-shaft">
            {[0,1,2,3,4,5].map(i => <span key={i} className="fg-rune" style={{ top: `${12 + i*14}%` }} />)}
          </span>
          <span className="fg-pillar-base" />
        </div>
      </div>

      <div className="fg-banners">
        <div className="fg-banner left">
          <span className="fg-banner-crest">✦</span>
          <span className="fg-banner-xv">XV</span>
          <span className="fg-banner-glyph">⚔</span>
        </div>
        <div className="fg-banner right">
          <span className="fg-banner-crest">✦</span>
          <span className="fg-banner-xv">XV</span>
          <span className="fg-banner-glyph">⚔</span>
        </div>
      </div>

      <div className="fg-lanterns">
        {LANTERNS.map((l, i) => (
          <div key={i} className="fg-lantern" style={{
            left: `${l.x}%`,
            '--len': `${l.len}px`,
            '--size': `${l.size}px`,
            '--delay': `${l.delay}s`,
            '--dur': `${l.dur}s`,
          }}>
            <span className="fg-lantern-line" />
            <span className="fg-lantern-body">
              <span className="fg-lantern-flame" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Constellation Streamer (flanks the title) ============
function ConstellationStreamer({ flip }) {
  // A small constellation cluster + connecting lines, flipped on one side
  const points = useMemo(() => [
    [20, 8], [38, 26], [22, 48], [40, 70], [18, 92], [34, 114]
  ], []);
  return (
    <div className="streamer" aria-hidden="true">
      <svg viewBox="0 0 60 132" xmlns="http://www.w3.org/2000/svg"
           style={{ transform: flip ? 'scaleX(-1)' : 'none' }}>
        <defs>
          <radialGradient id={`star-${flip ? 'l' : 'r'}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="rgba(255,255,255,1)" />
            <stop offset="0.4" stopColor="rgba(232,168,255,0.9)" />
            <stop offset="1" stopColor="rgba(192,98,255,0)" />
          </radialGradient>
          <linearGradient id={`line-${flip ? 'l' : 'r'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(232,216,255,0.1)" />
            <stop offset="0.5" stopColor="rgba(192,98,255,0.6)" />
            <stop offset="1" stopColor="rgba(232,216,255,0.1)" />
          </linearGradient>
        </defs>
        {/* Connecting line — gentle curve down */}
        <polyline points={points.map(p => p.join(',')).join(' ')}
                  fill="none" stroke={`url(#line-${flip ? 'l' : 'r'})`} strokeWidth="0.6" />
        {/* Stars at each node, with halos */}
        {points.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={i === 2 ? 5 : 3.5} fill={`url(#star-${flip ? 'l' : 'r'})`} opacity="0.7" />
            <circle cx={x} cy={y} r={i === 2 ? 1.4 : 0.9} fill="rgba(255,255,255,0.95)" />
          </g>
        ))}
        {/* Diagonal sparkle lines on the center star */}
        <g transform={`translate(${points[2][0]} ${points[2][1]})`} opacity="0.55">
          <line x1="-9" y1="0" x2="9" y2="0" stroke="rgba(232,216,255,0.7)" strokeWidth="0.4" />
          <line x1="0" y1="-9" x2="0" y2="9" stroke="rgba(232,216,255,0.7)" strokeWidth="0.4" />
        </g>
      </svg>
    </div>
  );
}

// ============ Header ============
function Header({ palette }) {
  return (
    <header className="header">
      <p className="header-eyebrow">Hamburg · The Ancients Decree</p>

      <div className="title-wrap">
        <ConstellationStreamer flip={true} />
        <h1 className="title">
          Wheel<span className="of">of</span>Fate
        </h1>
        <ConstellationStreamer flip={false} />
      </div>

      <p className="subtitle">
        Yield thy choice to the wandering stars. <span className="accent">Hero be sworn,</span> items
        be forged — and may the constellations guide thy lane.
      </p>
    </header>
  );
}

// ============ Filters ============
function Filters({ filters, setFilters, disabled }) {
  const update = (key, value) => setFilters({ ...filters, [key]: value });
  return (
    <section className="filters" aria-label="Filters">
      <div className="filter-group">
        <label htmlFor="role-filter">Role</label>
        <select className="filter" id="role-filter" value={filters.role}
                disabled={disabled}
                onChange={e => update('role', e.target.value)}>
          <option value="any">Any Role</option>
          <option value="Carry">Carry</option>
          <option value="Mid">Mid</option>
          <option value="Offlane">Offlane</option>
          <option value="Support">Support</option>
          <option value="Hard Support">Hard Support</option>
        </select>
      </div>
      <div className="filter-group">
        <label htmlFor="attr-filter">Primary Attribute</label>
        <select className="filter" id="attr-filter" value={filters.attr}
                disabled={disabled}
                onChange={e => update('attr', e.target.value)}>
          <option value="any">Any Attribute</option>
          <option value="str">Strength</option>
          <option value="agi">Agility</option>
          <option value="int">Intelligence</option>
          <option value="uni">Universal</option>
        </select>
      </div>
      <div className="filter-group">
        <label htmlFor="cx-filter">Difficulty</label>
        <select className="filter" id="cx-filter" value={filters.complexity}
                disabled={disabled}
                onChange={e => update('complexity', e.target.value)}>
          <option value="any">Any Difficulty</option>
          <option value="1">★ Easy</option>
          <option value="2">★★ Medium</option>
          <option value="3">★★★ Hard</option>
        </select>
      </div>
    </section>
  );
}

// ============ Wheel SVG ============
const CENTER = 300;
const R_OUTER = 270;
const R_INNER = 64;

function polarToCart(angle, r) {
  const rad = (angle - 90) * Math.PI / 180;
  return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)];
}
function arcPath(s, e, ro, ri) {
  const [x1, y1] = polarToCart(s, ro);
  const [x2, y2] = polarToCart(e, ro);
  const [x3, y3] = polarToCart(e, ri);
  const [x4, y4] = polarToCart(s, ri);
  const large = (e - s) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${ro} ${ro} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ri} ${ri} 0 ${large} 0 ${x4} ${y4} Z`;
}

function Wheel({ heroes, rotation, spinning, landed, chosenName }) {
  const n = heroes.length;
  const segAngle = n > 0 ? 360 / n : 0;

  // Adaptive label sizing — with up to 16 heroes, labels can be generous.
  // For tighter packs (e.g. someone picks 1-3 from a single attribute), bump down only slightly.
  const labelFontSize = n <= 8 ? 13 : n <= 12 ? 12 : 11;

  // Pole tilt for the wireframe globe — feels like a planet, not a flat disc
  const GLOBE_TILT = 22;

  return (
    <svg className="wheel-svg" viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="outerRim" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.85" stopColor="rgba(34, 18, 88, 0.6)" />
          <stop offset="0.92" stopColor="rgba(17, 8, 48, 0.95)" />
          <stop offset="1" stopColor="#0a0418" />
        </radialGradient>
        <radialGradient id="centerNebula" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f0d8ff" stopOpacity="1" />
          <stop offset="0.25" stopColor="#e090ff" stopOpacity="0.7" />
          <stop offset="0.6" stopColor="#c062ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#5a1a80" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="globeFill" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#5a2db8" stopOpacity="0.6" />
          <stop offset="0.55" stopColor="#1a0a44" stopOpacity="0.95" />
          <stop offset="1" stopColor="#0a0418" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="haloGrad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="hardGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {heroes.map((_, i) => {
          const [x, y] = polarToCart(i * segAngle, 240);
          return (
            <clipPath key={`hp-${i}`} id={`hp-${i}`}>
              <circle cx={x} cy={y} r="26" />
            </clipPath>
          );
        })}
      </defs>

      {/* Outer cosmic rim — soft fade, no heavy bronze look */}
      <circle cx={CENTER} cy={CENTER} r="298" fill="url(#outerRim)" />
      <circle cx={CENTER} cy={CENTER} r="296" fill="none" stroke="rgba(200, 176, 255, 0.32)" strokeWidth="1" />
      <circle cx={CENTER} cy={CENTER} r="287" fill="none" stroke="rgba(232, 168, 255, 0.18)" strokeWidth="0.5" strokeDasharray="2 4" />

      {/* Decorative star pricks around the very edge — sparse, alternating sizes */}
      <g opacity="0.85">
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * 360;
          const [x, y] = polarToCart(a, 277);
          const big = i % 3 === 0;
          return (
            <circle key={`s${i}`} cx={x} cy={y} r={big ? 1.6 : 0.7}
                    fill="white" opacity={big ? 0.95 : 0.45}
                    style={big ? { filter: 'drop-shadow(0 0 3px rgba(232,168,255,0.9))' } : null} />
          );
        })}
      </g>

      {/* Subtle inner constellation ring — guides the eye to the hero orbit */}
      <circle cx={CENTER} cy={CENTER} r="240" fill="none"
              stroke="rgba(200, 176, 255, 0.16)" strokeWidth="0.6"
              strokeDasharray="1 5" />

      {/* ROTOR — hero stars + connecting constellation lines + labels */}
      <g className="wheel-rotor" style={{ transform: `rotate(${rotation}deg)` }}>
        {/* Connecting constellation lines (skip if only 1 hero) */}
        {n > 1 && heroes.map((_, i) => {
          const a1 = i * segAngle;
          const a2 = ((i + 1) % n) * segAngle;
          const [x1, y1] = polarToCart(a1, 240);
          const [x2, y2] = polarToCart(a2, 240);
          return (
            <line key={`cn-${i}`}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(232, 168, 255, 0.32)"
                  strokeWidth="0.7"
                  strokeDasharray="3 4" />
          );
        })}

        {/* Hero stars */}
        {heroes.map((hero, i) => {
          const a = i * segAngle;
          const [x, y] = polarToCart(a, 240);
          const isChosen = landed && hero.name === chosenName;
          const attrColor = ATTR_BRIGHT[hero.attr];
          return (
            <g key={`h-${i}`} style={{ color: attrColor, transition: 'opacity 0.4s' }}
               opacity={landed && !isChosen ? 0.45 : 1}>
              {/* Outer glow halo (radial gradient inheriting attr color via currentColor) */}
              <circle cx={x} cy={y} r={isChosen ? 56 : 42}
                      fill="url(#haloGrad)"
                      style={{ transition: 'r 0.4s' }} />
              {/* Inner softer halo */}
              <circle cx={x} cy={y} r={isChosen ? 36 : 32} fill={attrColor}
                      opacity={isChosen ? 0.28 : 0.12}
                      style={{ transition: 'all 0.4s' }} />
              {/* Portrait bezel */}
              <circle cx={x} cy={y} r="28" fill="#160a32" />
              {/* Hero portrait */}
              <image href={heroImg(hero.name)}
                     x={x - 26} y={y - 26} width="52" height="52"
                     clipPath={`url(#hp-${i})`}
                     preserveAspectRatio="xMidYMid slice" />
              {/* Bezel rings */}
              <circle cx={x} cy={y} r="26" fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="1.5" />
              <circle cx={x} cy={y} r="28" fill="none"
                      stroke={attrColor}
                      strokeWidth={isChosen ? 2.8 : 1.6}
                      style={{ transition: 'stroke-width 0.4s' }} />
              {/* Sparkle on top of chosen hero */}
              {isChosen && (
                <g transform={`translate(${x} ${y - 36})`}>
                  <path d="M0 -6 L1.4 -1.4 L6 0 L1.4 1.4 L0 6 L-1.4 1.4 L-6 0 L-1.4 -1.4 Z"
                        fill="white" opacity="0.95">
                    <animate attributeName="opacity" values="0.8;1;0.8" dur="1.2s" repeatCount="indefinite" />
                  </path>
                </g>
              )}
            </g>
          );
        })}

        {/* Hero name labels — outside the portrait ring, tangent to the orbit */}
        {heroes.map((hero, i) => {
          const a = i * segAngle;
          const [lx, ly] = polarToCart(a, 282);
          // Tangent angle so text reads along the orbit. Flip on the bottom half so it's not upside-down.
          let rot = a;
          if (a > 90 && a < 270) rot = a + 180;
          const isChosen = landed && hero.name === chosenName;
          return (
            <text key={`lbl-${i}`}
                  x={lx} y={ly}
                  fill={isChosen ? '#ffffff' : '#e8d8ff'}
                  fontFamily="Cinzel, serif"
                  fontWeight={isChosen ? 800 : 600}
                  fontSize={labelFontSize}
                  letterSpacing="0.08em"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${rot} ${lx} ${ly})`}
                  style={{
                    textTransform: 'uppercase',
                    filter: isChosen
                      ? 'drop-shadow(0 0 8px rgba(255,255,255,0.9))'
                      : 'drop-shadow(0 0 4px rgba(192, 98, 255, 0.5))',
                    transition: 'fill 0.4s',
                    opacity: landed && !isChosen ? 0.5 : 1,
                  }}>
              {hero.name}
            </text>
          );
        })}
      </g>

      {/* CENTRAL NEBULA + WIREFRAME GLOBE (static, big and prominent) */}
      <circle cx={CENTER} cy={CENTER} r="130" fill="url(#centerNebula)"
              opacity={spinning ? 1 : 0.7}>
        {spinning && (
          <animate attributeName="r" values="120;145;120" dur="1s" repeatCount="indefinite" />
        )}
      </circle>

      <g transform={`translate(${CENTER} ${CENTER})`} filter="url(#softGlow)">
        {/* Globe disc */}
        <circle r="100" fill="url(#globeFill)" stroke="#c8b0ff" strokeWidth="0.8" opacity="0.95" />

        {/* Latitude lines */}
        <g transform={`rotate(${GLOBE_TILT})`}>
          <ellipse rx="100" ry="9" fill="none" stroke="#e090ff" strokeWidth="0.9" opacity="0.85" />
          <ellipse rx="98" ry="36" fill="none" stroke="#c8b0ff" strokeWidth="0.55" opacity="0.6" />
          <ellipse rx="92" ry="62" fill="none" stroke="#c8b0ff" strokeWidth="0.5" opacity="0.5" />
          <ellipse rx="78" ry="86" fill="none" stroke="#c8b0ff" strokeWidth="0.45" opacity="0.42" />
          <ellipse rx="50" ry="96" fill="none" stroke="#c8b0ff" strokeWidth="0.4" opacity="0.32" />
        </g>

        {/* Longitude lines */}
        <g transform={`rotate(${GLOBE_TILT})`}>
          <ellipse rx="9" ry="100" fill="none" stroke="#e090ff" strokeWidth="0.9" opacity="0.85" />
          <ellipse rx="36" ry="98" fill="none" stroke="#c8b0ff" strokeWidth="0.55" opacity="0.6" />
          <ellipse rx="62" ry="92" fill="none" stroke="#c8b0ff" strokeWidth="0.5" opacity="0.5" />
          <ellipse rx="86" ry="78" fill="none" stroke="#c8b0ff" strokeWidth="0.45" opacity="0.42" />
          <ellipse rx="96" ry="50" fill="none" stroke="#c8b0ff" strokeWidth="0.4" opacity="0.32" />
        </g>

        {/* Outer tilted orbit ring around the globe */}
        <g transform={`rotate(${GLOBE_TILT - 50})`} opacity="0.7">
          <ellipse rx="115" ry="20" fill="none" stroke="#e090ff" strokeWidth="0.7" />
          {/* A small satellite ember on this orbit */}
          <circle cx="115" cy="0" r="2" fill="white">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Star pricks on globe surface */}
        {[
          [-32, -44, true], [22, -28, false], [-18, 12, true], [38, 14, false],
          [-50, -8, false], [10, 48, true], [54, -10, false], [-12, -56, false],
          [44, 38, false], [-44, 36, false], [0, -30, true], [-22, 56, false],
        ].map(([x, y, big], i) => (
          <g key={`gs-${i}`}>
            <circle cx={x} cy={y} r={big ? 1.9 : 1.1}
                    fill="white" opacity={big ? 1 : 0.85}>
              <animate attributeName="opacity"
                       values={big ? "0.85;1;0.85" : "0.55;0.9;0.55"}
                       dur={`${2 + i * 0.25}s`} repeatCount="indefinite" />
            </circle>
            {big && (
              <circle cx={x} cy={y} r="4" fill="white" opacity="0.18" />
            )}
          </g>
        ))}

        {/* Center brightest star */}
        <circle r="4.5" fill="white" />
        <circle r="2.2" fill="#e090ff">
          {spinning && (
            <animate attributeName="r" values="2.2;5;2.2" dur="0.5s" repeatCount="indefinite" />
          )}
        </circle>

        {/* Crosshair sparkle on center */}
        <g opacity="0.5" filter="url(#hardGlow)">
          <line x1="-14" y1="0" x2="14" y2="0" stroke="white" strokeWidth="0.5" />
          <line x1="0" y1="-14" x2="0" y2="14" stroke="white" strokeWidth="0.5" />
        </g>
      </g>
    </svg>
  );
}

// ============ Wheel Pointer ============
function Pointer() {
  return (
    <div className="pointer-wrap" aria-hidden="true">
      <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="ptr-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0d8ff" />
            <stop offset="0.3" stopColor="#c8b0ff" />
            <stop offset="0.6" stopColor="#c062ff" />
            <stop offset="1" stopColor="#3a1f6a" />
          </linearGradient>
          <linearGradient id="ptr-shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="1" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        {/* Pointer body */}
        <path d="M30 78 L8 28 Q8 6 30 6 Q52 6 52 28 Z"
              fill="url(#ptr-grad)" stroke="#c8b0ff" strokeWidth="1.5"
              strokeLinejoin="round" />
        <path d="M30 70 L14 30 Q14 12 30 12 Q46 12 46 30 Z"
              fill="url(#ptr-shine)" opacity="0.6" />
        <circle cx="30" cy="22" r="6" fill="#1a0532" stroke="#c8b0ff" strokeWidth="1.2" />
        <circle cx="30" cy="22" r="2.5" fill="#e090ff">
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="18" cy="36" r="1.8" fill="#5a1a80" />
        <circle cx="42" cy="36" r="1.8" fill="#5a1a80" />
      </svg>
    </div>
  );
}

// ============ Empty Globe (cosmic sigil for empty state) ============
function EmptySigil() {
  return (
    <div className="empty-globe">
      <svg className="spin-cw" viewBox="0 0 160 160">
        <defs>
          <radialGradient id="eg-fill" cx="0.35" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#3a1f7a" stopOpacity="0.4" />
            <stop offset="1" stopColor="#0a0418" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="80" cy="80" r="70" fill="url(#eg-fill)" />
        <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(200,176,255,0.7)" strokeWidth="0.8" />
        <circle cx="80" cy="80" r="62" fill="none" stroke="rgba(200,176,255,0.3)" strokeWidth="0.5" strokeDasharray="3 5" />
        {/* Latitude */}
        <ellipse cx="80" cy="80" rx="70" ry="8" fill="none" stroke="rgba(232,168,255,0.6)" strokeWidth="0.7" />
        <ellipse cx="80" cy="80" rx="66" ry="28" fill="none" stroke="rgba(200,176,255,0.45)" strokeWidth="0.5" />
        <ellipse cx="80" cy="80" rx="56" ry="46" fill="none" stroke="rgba(200,176,255,0.4)" strokeWidth="0.5" />
        {/* Longitude */}
        <ellipse cx="80" cy="80" rx="8" ry="70" fill="none" stroke="rgba(232,168,255,0.6)" strokeWidth="0.7" />
        <ellipse cx="80" cy="80" rx="28" ry="66" fill="none" stroke="rgba(200,176,255,0.45)" strokeWidth="0.5" />
        <ellipse cx="80" cy="80" rx="46" ry="56" fill="none" stroke="rgba(200,176,255,0.4)" strokeWidth="0.5" />
      </svg>
      <svg className="spin-ccw" viewBox="0 0 160 160">
        {/* Tilted constellation ring */}
        <g transform="rotate(28 80 80)">
          <ellipse cx="80" cy="80" rx="76" ry="14" fill="none" stroke="rgba(232,168,255,0.65)" strokeWidth="0.6" />
        </g>
        {/* Constellation stars on globe surface */}
        {[
          [60, 50], [98, 62], [70, 78], [104, 88], [56, 92], [82, 110], [110, 76], [70, 36]
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.4" fill="#ffffff" opacity="0.95" />
        ))}
        {/* Center sparkle */}
        <circle cx="80" cy="80" r="3" fill="#ffffff" />
        <circle cx="80" cy="80" r="1.4" fill="#e090ff" />
      </svg>
    </div>
  );
}

// ============ Reveal item (icon + name) ============
function RevealItem({ name, i }) {
  const [err, setErr] = useState(false);
  return (
    <div className="reveal-item" style={{ '--i': i }} title={name}>
      <div className="reveal-item-frame">
        {!err
          ? <img src={itemImg(name)} alt={name} loading="eager" onError={() => setErr(true)} />
          : <div className="reveal-item-missing">{initials(name)}</div>}
        <span className="reveal-item-corner tl" />
        <span className="reveal-item-corner br" />
      </div>
      <div className="reveal-item-name">{name}</div>
    </div>
  );
}

// ============ Cinematic Hero Reveal (full-screen takeover) ============
function HeroReveal({ hero, role, items, closing, mood, entrance, ghostName, onCastAgain, onReforge, onClose }) {
  const [imgError, setImgError] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => { setImgError(false); }, [hero && hero.name]);
  // After the entrance plays, drop the animation classes so the reveal rests
  // at its natural (fully-visible) state — robust even if the tab is hidden
  // (which would otherwise pause the entrance and leave it stuck invisible).
  useEffect(() => {
    setSettled(false);
    const id = setTimeout(() => setSettled(true), 1750);
    return () => clearTimeout(id);
  }, [hero && hero.name]);
  if (!hero) return null;

  const glow = ATTR_BRIGHT[hero.attr] || '#c088ff';
  const phase = closing ? 'is-out' : (settled ? 'is-settled' : 'is-in');
  const cls = [
    'reveal-stage',
    `attr-${hero.attr}`,
    `mood-${mood || 'cinematic'}`,
    `enter-${entrance || 'sweep'}`,
    phase,
  ].join(' ');

  return (
    <div className={cls}
         style={{ '--hero': glow }}
         role="dialog" aria-label={`Fate sealed — ${hero.name}`}>
      <div className="reveal-bg" />
      <div className="reveal-rays" />
      <div className="reveal-beam" />
      <div className="reveal-vignette" />

      <div className="reveal-top">
        <p className="reveal-eyebrow"><span>✦</span> Fate is Sealed <span>✦</span></p>
      </div>

      <div className="reveal-mid">
        {ghostName && <h2 className="reveal-ghostname" aria-hidden="true">{hero.name}</h2>}
        <div className="reveal-hero-wrap">
          {!imgError
            ? <img className="reveal-hero" src={heroPortrait(hero.name)} alt={hero.name}
                   onError={() => setImgError(true)} />
            : <div className="reveal-hero-fallback">{initials(hero.name)}</div>}
          <div className="reveal-pedestal" />
        </div>
        <div className="reveal-nameplate">
          <h1 className="reveal-name">{hero.name}</h1>
          <p className="reveal-tag">{hero.tag || `Sworn to the ${(role || '').toLowerCase()} path.`}</p>
        </div>
      </div>

      <div className="reveal-bottom">
        <div className="reveal-items-head">
          <span className="ln" />
          <span className="lbl">Endgame Inventory</span>
          <span className="ln" />
        </div>
        <div className="reveal-items">
          {items.map((it, i) => <RevealItem key={it + i} name={it} i={i} />)}
        </div>
        <div className="reveal-controls">
          <button className="spin-btn reveal-cast" onClick={onCastAgain}>
            <span className="blade">⚔</span>
            Cast Again
            <span className="blade blade-r">⚔</span>
          </button>
          <div className="reveal-subcontrols">
            <button className="ghost-btn" onClick={onReforge}>Reforge Items</button>
            <button className="ghost-btn" onClick={onClose}>Return to the Wheel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ App ============
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "cosmic",
  "background": "photo",
  "photoGrade": "subtle",
  "atmosphere": "mist",
  "framing": "pillars",
  "revealMood": "cinematic",
  "heroEntrance": "sweep",
  "motion": "dramatic",
  "ghostName": true
}/*EDITMODE-END*/;

function App() {
  const [filters, setFilters] = useState({ role: 'any', attr: 'any', complexity: 'any' });
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [landed, setLanded] = useState(false);
  const [shake, setShake] = useState(false);
  const [sparks, setSparks] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [role, setRole] = useState(null);
  const [skillBuild, setSkillBuild] = useState(null);
  const [items, setItems] = useState([]);
  const [revealKey, setRevealKey] = useState(0);
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealClosing, setRevealClosing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [status, setStatus] = useState({ msg: "Awaiting fate.", live: false });
  const [imagesReady, setImagesReady] = useState(false);
  const [wheelSample, setWheelSample] = useState([]);

  const tweaks = window.useTweaks
    ? window.useTweaks(TWEAK_DEFAULTS)
    : [TWEAK_DEFAULTS, () => {}];
  const t = tweaks[0];
  const setTweak = tweaks[1];

  useEffect(() => {
    imageDataPromise.then(() => setImagesReady(true));
  }, []);

  // Parallax scroll listener — throttle via rAF
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last) >= 0.5) {
          document.documentElement.style.setProperty('--py', y + 'px');
          last = y;
        }
        raf = 0;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Apply palette class on body
  useEffect(() => {
    document.body.classList.remove('theme-cosmic', 'theme-aurora', 'theme-twilight');
    document.body.classList.add(`theme-${t.palette || 'cosmic'}`);
  }, [t.palette]);

  const filteredHeroes = useMemo(() => {
    return window.HEROES.filter(h => {
      if (filters.role !== 'any' && !h.roles.includes(filters.role)) return false;
      if (filters.attr !== 'any' && h.attr !== filters.attr) return false;
      if (filters.complexity !== 'any' && h.complexity !== Number(filters.complexity)) return false;
      return true;
    });
  }, [filters]);

  // Repopulate the wheel sample whenever the filter pool changes (and on first mount)
  useEffect(() => {
    setWheelSample(buildWheelSample(filteredHeroes));
  }, [filteredHeroes]);

  // Reset rotation when filters change
  useEffect(() => {
    if (!spinning) setRotation(0);
  }, [filters]);

  const spin = useCallback(() => {
    if (spinning) return;
    if (filteredHeroes.length === 0) {
      setStatus({ msg: "The Ancients name no champion for these terms.", live: true });
      return;
    }

    setSpinning(true);
    setLanded(false);
    setRevealOpen(false);
    setRevealClosing(false);
    setStatus({ msg: "The wheel turns…", live: true });

    // Pick chosen from the FULL filtered pool (not just what's on the wheel),
    // then guarantee the chosen ends up on the wheel by rebuilding the sample.
    const hero = pick(filteredHeroes);
    // Preload the full-body render so the cinematic reveal lands instantly.
    try { const pre = new Image(); pre.src = heroPortrait(hero.name); } catch (e) {}
    const newSample = buildWheelSample(filteredHeroes, hero);
    setWheelSample(newSample);

    const landIdx = newSample.findIndex(h => h === hero);
    const n = newSample.length;
    const segAngle = 360 / n;
    // Hero stars sit at angle `i * segAngle` from the top (no +segAngle/2),
    // so the rotation just brings idx * segAngle to 0.
    const target = -(landIdx * segAngle);
    const jitter = (Math.random() - 0.5) * Math.min(segAngle * 0.18, 4);
    const fullSpins = 9;
    const current = rotation;
    const newRot = current + fullSpins * 360 + (target + jitter - (current % 360));
    setRotation(newRot);

    // Periodic spark bursts during the spin
    const sparkInterval = setInterval(() => {
      const burst = [];
      const burstCount = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < burstCount; i++) {
        const baseAngle = -90 + (Math.random() - 0.5) * 50;
        const dist = 80 + Math.random() * 140;
        const a = (baseAngle * Math.PI) / 180;
        burst.push({
          id: Math.random().toString(36).slice(2),
          x: 50 + Math.cos(a) * 6,
          y: 8 + Math.sin(a) * 4,
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist,
          dur: 700 + Math.random() * 500,
        });
      }
      setSparks(s => [...s.slice(-30), ...burst]);
    }, 140);

    setTimeout(() => {
      clearInterval(sparkInterval);
      setSpinning(false);
      setLanded(true);
      setShake(true);
      // Big final burst on landing
      const final = [];
      for (let i = 0; i < 18; i++) {
        const a = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.3;
        const dist = 140 + Math.random() * 80;
        final.push({
          id: 'f' + Math.random().toString(36).slice(2),
          x: 50, y: 12,
          dx: Math.cos(a) * dist,
          dy: Math.sin(a) * dist - 30,
          dur: 900 + Math.random() * 400,
        });
      }
      setSparks(final);

      const chosenRole = filters.role !== 'any' ? filters.role : pick(hero.roles);
      setChosen(hero);
      setRole(chosenRole);
      setSkillBuild(pick(window.SKILL_BUILDS));
      setItems(pickN(window.ITEMS, 6));
      setRevealKey(k => k + 1);
      setStatus({ msg: `Fate is sealed — ${hero.name}.`, live: false });

      // Landing flash, then raise the cinematic reveal once the dust settles.
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
      setTimeout(() => { setRevealOpen(true); setRevealClosing(false); }, 480);

      setTimeout(() => setShake(false), 600);
      setTimeout(() => setSparks([]), 1200);
      // Keep `landed` true so the chosen hero star stays highlighted until the next spin
    }, 7200);
  }, [spinning, filteredHeroes, rotation, filters.role]);

  const rerollItems = useCallback(() => {
    if (!chosen) return;
    setItems(pickN(window.ITEMS, 6));
    setSkillBuild(pick(window.SKILL_BUILDS));
    setStatus({ msg: "Inventory reforged.", live: false });
  }, [chosen]);

  // Close the cinematic reveal with its exit animation, then run an optional callback.
  const closeReveal = useCallback((after) => {
    setRevealClosing(true);
    setTimeout(() => {
      setRevealOpen(false);
      setRevealClosing(false);
      if (typeof after === 'function') after();
    }, 420);
  }, []);
  const castAgain = useCallback(() => { closeReveal(() => spin()); }, [closeReveal, spin]);

  const copyBuild = useCallback(() => {
    if (!chosen) return;
    const text = `${chosen.name} (${ATTR_NAMES[chosen.attr]}, ${role})
Lane: ${chosen.lane} · Difficulty: ${COMPLEXITY_LABELS[chosen.complexity]}
Skill build: ${skillBuild}

Endgame items: ${items.join(', ')}`;
    navigator.clipboard?.writeText(text).then(() => {
      setStatus({ msg: "Build copied to scroll.", live: true });
      setTimeout(() => setStatus({ msg: `Fate is sealed — ${chosen.name}.`, live: false }), 2000);
    }).catch(() => setStatus({ msg: "The scroll resists.", live: false }));
  }, [chosen, role, skillBuild, items]);

  const TweaksPanel = window.TweaksPanel;
  const TweakSection = window.TweakSection;
  const TweakRadio = window.TweakRadio;
  const TweakToggle = window.TweakToggle;

  return (
    <React.Fragment>
      <Scene bg={t.background} grade={t.photoGrade} />
      <Atmosphere mode={t.atmosphere} />
      <Foreground framing={t.framing} />
      <div className="app">
      <Header palette={t.palette} />

      <Filters filters={filters} setFilters={setFilters} disabled={spinning} />

      <div className="main main-centered">
        <div className="wheel-section">
          <div className={`wheel-stage${spinning ? ' spinning' : ''}${landed ? ' landed' : ''}${shake ? ' shake' : ''}`}>
            {spinning && t.motion !== 'subtle' && <div className="spin-rays" key={`r${revealKey}`} />}
            {landed && t.motion !== 'subtle' && <div className="shockwave" key={`s${revealKey}`} />}
            <Pointer />
            <Wheel heroes={wheelSample} rotation={rotation}
                   spinning={spinning} landed={landed}
                   chosenName={chosen?.name} />
            <div className="sparks">
              {sparks.map(s => (
                <span key={s.id} className="spark" style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  '--dx': `${s.dx}px`,
                  '--dy': `${s.dy}px`,
                  animationDuration: `${s.dur}ms`,
                }} />
              ))}
            </div>
          </div>

          <div className="spin-controls">
            <button className="spin-btn" onClick={spin}
                    disabled={spinning || filteredHeroes.length === 0}>
              <span className="blade">⚔</span>
              Cast the Lot
              <span className="blade blade-r">⚔</span>
            </button>
            <p className={`status${status.live ? ' live' : ''}`}>{status.msg}</p>
          </div>
        </div>
      </div>

      <footer className="footer">
        <div className="footer-line">
          <span className="line" />
          <span className="crest">✦</span>
          <span className="line" />
        </div>
        <p className="footer-tag">
          Hamburg <span className="ember">·</span> The International <span className="ember">XV</span> <span className="ember">·</span> Beneath the Wandering Stars
        </p>
      </footer>
      </div>

      {flash && t.motion !== 'subtle' && <div className="land-flash" key={`f${revealKey}`} />}

      {revealOpen && chosen && (
        <HeroReveal hero={chosen} role={role} items={items}
                    closing={revealClosing}
                    mood={t.revealMood || 'cinematic'}
                    entrance={t.heroEntrance || 'sweep'}
                    ghostName={t.ghostName !== false}
                    onCastAgain={castAgain}
                    onReforge={rerollItems}
                    onClose={() => closeReveal()} />
      )}

      {TweaksPanel && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Background">
            <TweakRadio label="Scene source"
                        value={t.background || 'drawn'}
                        onChange={v => setTweak('background', v)}
                        options={[
                          { value: 'drawn', label: 'Illustrated' },
                          { value: 'photo', label: 'Real Photos' }
                        ]} />
            <TweakRadio label="Photo color grade"
                        value={t.photoGrade || 'strong'}
                        onChange={v => setTweak('photoGrade', v)}
                        options={[
                          { value: 'strong', label: 'Cosmic' },
                          { value: 'subtle', label: 'Subtle' },
                          { value: 'none', label: 'Natural' }
                        ]} />
          </TweakSection>
          <TweakSection title="Palette">
            <TweakRadio label="Cosmic colorway"
                        value={t.palette || 'cosmic'}
                        onChange={v => setTweak('palette', v)}
                        options={[
                          { value: 'cosmic', label: 'Cosmic' },
                          { value: 'aurora', label: 'Aurora' },
                          { value: 'twilight', label: 'Twilight' }
                        ]} />
          </TweakSection>
          <TweakSection title="Atmosphere">
            <TweakRadio label="Mist & fog"
                        value={t.atmosphere || 'mist'}
                        onChange={v => setTweak('atmosphere', v)}
                        options={[
                          { value: 'none', label: 'None' },
                          { value: 'mist', label: 'Drifting Mist' },
                          { value: 'fog', label: 'Ground Fog' },
                          { value: 'haze', label: 'Ethereal Haze' },
                          { value: 'veil', label: 'Veil (dense)' }
                        ]} />
          </TweakSection>
          <TweakSection title="Scene Framing">
            <TweakRadio label="Foreground"
                        value={t.framing || 'pillars'}
                        onChange={v => setTweak('framing', v)}
                        options={[
                          { value: 'pillars', label: 'Pillars' },
                          { value: 'banners', label: 'Banners' },
                          { value: 'lanterns', label: 'Lanterns' },
                          { value: 'none', label: 'None' }
                        ]} />
          </TweakSection>
          <TweakSection title="Hero Reveal">
            <TweakRadio label="Backdrop mood"
                        value={t.revealMood || 'cinematic'}
                        onChange={v => setTweak('revealMood', v)}
                        options={[
                          { value: 'cinematic', label: 'Cinematic' },
                          { value: 'cosmic', label: 'Cosmic' }
                        ]} />
            <TweakRadio label="Entrance"
                        value={t.heroEntrance || 'sweep'}
                        onChange={v => setTweak('heroEntrance', v)}
                        options={[
                          { value: 'sweep', label: 'Sweep Up' },
                          { value: 'materialize', label: 'Materialize' }
                        ]} />
            <TweakToggle label="Giant name behind hero"
                         value={t.ghostName !== false}
                         onChange={v => setTweak('ghostName', v)} />
          </TweakSection>
          <TweakSection title="Motion">
            <TweakRadio label="Spin & landing drama"
                        value={t.motion || 'dramatic'}
                        onChange={v => setTweak('motion', v)}
                        options={[
                          { value: 'dramatic', label: 'Dramatic' },
                          { value: 'subtle', label: 'Subtle' }
                        ]} />
          </TweakSection>
        </TweaksPanel>
      )}
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
