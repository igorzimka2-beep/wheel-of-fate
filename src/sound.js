// === Wheel of Fate sound patch (synthesized, Web Audio API only) ===========
// Adds a wheel-spin "clack" tick synced to the CSS rotation, a speed-linked
// low hum, and a ceremonial chime when a hero is sealed. Every sound is
// synthesized in code — no audio files, nothing binary embedded in the
// bundle. Self-contained IIFE: injects its own mute/volume widget next to
// the "Configure pool" button and hooks the existing wheel DOM. Never
// touches React state, the roll logic, or the CSS @keyframes/transition
// that actually drives the spin.
//
// --- How this stays in sync with the CSS-driven spin -----------------------
// The wheel's rotation is a plain CSS transition on .wheel-rotor:
//   transition: transform 7.2s cubic-bezier(0.08, 0.62, 0.06, 1);
// There's no per-frame JS driving it, so we can't just "listen" to the
// animation. Instead we detect the exact moment React writes a new
// rotation via a MutationObserver on .wheel-rotor's style attribute (with
// attributeOldValue so we get both the previous and the new "rotate(Ndeg)"
// values from the single mutation record), then re-run the *same* easing
// curve ourselves in a requestAnimationFrame loop to know where the wheel
// visually is at any instant. A tick fires every time that simulated angle
// crosses a segment boundary.
//
// MutationObserver (over transitionstart/transitionend) was chosen because
// it hands us the exact start AND end rotation values in one shot (via
// oldValue vs. the freshly-written style), with no dependency on transition
// event timing/support quirks — we only need the two numbers and a
// performance.now() timestamp; the rest is deterministic math.
(function () {
  // ---------------------------------------------------------------------
  // Cubic-bezier progress function — mirrors the CSS transition-timing-
  // function exactly, so our JS-side "where is the wheel right now" always
  // matches what's on screen. Standard Newton-Raphson w/ bisection fallback
  // (same approach browsers themselves use).
  // ---------------------------------------------------------------------
  function makeBezier(mX1, mY1, mX2, mY2) {
    function A(a1, a2) { return 1.0 - 3.0 * a2 + 3.0 * a1; }
    function B(a1, a2) { return 3.0 * a2 - 6.0 * a1; }
    function C(a1) { return 3.0 * a1; }
    function calc(t, a1, a2) { return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t; }
    function slope(t, a1, a2) { return 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1); }

    function tForX(x) {
      var t = x;
      for (var i = 0; i < 8; i++) {
        var dx = calc(t, mX1, mX2) - x;
        if (Math.abs(dx) < 1e-6) return t;
        var d = slope(t, mX1, mX2);
        if (Math.abs(d) < 1e-6) break;
        t -= dx / d;
      }
      var lo = 0, hi = 1;
      t = x;
      for (var j = 0; j < 20; j++) {
        var cx = calc(t, mX1, mX2);
        if (Math.abs(cx - x) < 1e-6) return t;
        if (cx < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return t;
    }

    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      return calc(tForX(x), mY1, mY2);
    };
  }
  var wheelEase = makeBezier(0.08, 0.62, 0.06, 1);
  var SPIN_DURATION = 7200; // ms — must match .wheel-rotor's transition duration

  var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  var audioCtx = null;
  var masterGain = null;
  var muted = false;
  var volume = reducedMotion ? 0.18 : 0.4; // 0..1, sound starts on at a modest level
  var noiseBuffer = null; // shared short white-noise buffer, reused by every tick

  var rafId = 0;
  var humNodes = null; // { osc1, osc2, filter, gain } while a spin is in flight

  function ensureAudioCtx() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = muted ? 0 : volume;
      masterGain.connect(audioCtx.destination);
      noiseBuffer = makeNoiseBuffer(audioCtx, 0.08);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function makeNoiseBuffer(ctx, seconds) {
    var len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function applyVolume() {
    if (!masterGain || !audioCtx) return;
    var target = muted ? 0 : volume;
    masterGain.gain.setTargetAtTime(target, audioCtx.currentTime, 0.03);
  }

  // ---------------------------------------------------------------------
  // Sound: tick (segment "clack")
  // ---------------------------------------------------------------------
  function playTick(speed01) {
    var ctx = audioCtx;
    if (!ctx || !noiseBuffer) return;
    var now = ctx.currentTime;

    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;

    var band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    // Slight pitch/gain variation so 100+ identical ticks don't sound robotic.
    var jitter = 1 + (Math.random() - 0.5) * 0.16; // +/-8%
    var baseFreq = 1900 + speed01 * 900; // faster spin -> a touch brighter
    band.frequency.value = baseFreq * jitter;
    band.Q.value = 5 + Math.random() * 3;

    var gain = ctx.createGain();
    var peak = 0.5 * (0.85 + Math.random() * 0.3); // +/-15% loudness variation
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.022);

    src.connect(band);
    band.connect(gain);
    gain.connect(masterGain);

    src.start(now);
    src.stop(now + 0.03);
    src.onended = function () {
      try { src.disconnect(); band.disconnect(); gain.disconnect(); } catch (e) {}
    };
  }

  // ---------------------------------------------------------------------
  // Sound: rotation hum — one persistent pair of oscillators per spin,
  // volume/tone tracks angular speed, faded out when the spin ends.
  // ---------------------------------------------------------------------
  function startHum() {
    var ctx = audioCtx;
    if (!ctx || reducedMotion) return;
    stopHum(true);

    var osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 62;
    var osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 62 * 1.503; // detuned fifth-ish, adds body without beating too hard

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 0.7;

    var gain = ctx.createGain();
    gain.gain.value = 0;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    osc1.start();
    osc2.start();

    humNodes = { osc1: osc1, osc2: osc2, filter: filter, gain: gain };
  }

  function updateHum(speed01) {
    if (!humNodes || !audioCtx) return;
    var now = audioCtx.currentTime;
    var g = Math.min(1, speed01) * 0.22;
    humNodes.gain.gain.setTargetAtTime(g, now, 0.08);
    humNodes.filter.frequency.setTargetAtTime(180 + speed01 * 420, now, 0.12);
  }

  function stopHum(immediate) {
    if (!humNodes) return;
    var nodes = humNodes;
    humNodes = null;
    var ctx = audioCtx;
    if (!ctx) return;
    var now = ctx.currentTime;
    var release = immediate ? 0.03 : 0.5;
    try {
      nodes.gain.gain.cancelScheduledValues(now);
      nodes.gain.gain.setTargetAtTime(0, now, release / 3);
    } catch (e) {}
    var stopAt = now + release + 0.05;
    try { nodes.osc1.stop(stopAt); } catch (e) {}
    try { nodes.osc2.stop(stopAt); } catch (e) {}
    nodes.osc1.onended = function () {
      try { nodes.osc1.disconnect(); nodes.osc2.disconnect(); nodes.filter.disconnect(); nodes.gain.disconnect(); } catch (e) {}
    };
  }

  // ---------------------------------------------------------------------
  // Sound: start "whoosh" — short filtered noise sweep
  // ---------------------------------------------------------------------
  function playWhoosh() {
    var ctx = audioCtx;
    if (!ctx || !noiseBuffer || reducedMotion) return;
    var now = ctx.currentTime;

    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.22);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0006, now + 0.3);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    src.start(now);
    src.stop(now + 0.32);
    src.onended = function () {
      try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch (e) {}
    };
  }

  // ---------------------------------------------------------------------
  // Sound: seal chime — a warm, soft chord for when fate lands.
  // ---------------------------------------------------------------------
  function playSeal() {
    var ctx = audioCtx;
    if (!ctx) return;
    var now = ctx.currentTime;
    var root = 220; // A3 — sits under the app's mystic/ceremonial register
    var partials = [
      { ratio: 1, gain: 0.22, type: 'sine' },
      { ratio: 1.5, gain: 0.16, type: 'sine' },   // fifth
      { ratio: 2, gain: 0.14, type: 'triangle' }, // octave
      { ratio: 3, gain: 0.08, type: 'sine' },     // shimmer
    ];
    var bus = ctx.createGain();
    bus.gain.value = reducedMotion ? 0.5 : 1;
    bus.connect(masterGain);

    partials.forEach(function (p, i) {
      var osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = root * p.ratio;
      osc.detune.value = (Math.random() - 0.5) * 6;

      var g = ctx.createGain();
      var attack = 0.09 + i * 0.02;
      var release = 2.0 + i * 0.3;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(p.gain, now + attack);
      g.gain.exponentialRampToValueAtTime(0.0008, now + attack + release);

      osc.connect(g);
      g.connect(bus);
      osc.start(now);
      var stopAt = now + attack + release + 0.1;
      osc.stop(stopAt);
      osc.onended = function () {
        try { osc.disconnect(); g.disconnect(); } catch (e) {}
      };
    });
    setTimeout(function () {
      try { bus.disconnect(); } catch (e) {}
    }, 3200);
  }

  // ---------------------------------------------------------------------
  // Segment count — one <image> hero portrait per hero inside the rotor.
  // ---------------------------------------------------------------------
  function getSegmentCount() {
    var rotor = document.querySelector('.wheel-rotor');
    if (!rotor) return 0;
    var n = rotor.querySelectorAll('image').length;
    return n > 0 ? n : 0;
  }

  function parseRotateDeg(styleText) {
    if (!styleText) return null;
    var m = /rotate\(\s*(-?[\d.]+)deg\s*\)/.exec(styleText);
    return m ? parseFloat(m[1]) : null;
  }

  // ---------------------------------------------------------------------
  // Drives ticks + hum for one spin, replaying the CSS easing in JS.
  // ---------------------------------------------------------------------
  function runSpinAudio(startAngle, endAngle) {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (!audioCtx) return;

    var n = getSegmentCount();
    var segAngle = n > 0 ? 360 / n : 30;
    var t0 = performance.now();
    var lastSeg = Math.floor(startAngle / segAngle);
    var lastAngle = startAngle;
    var lastT = t0;
    var maxSpeed = Math.abs(endAngle - startAngle) / (SPIN_DURATION * 0.12); // rough deg/ms near the fastest part

    // playWhoosh(); // disabled: no whoosh on spin start — ticks/hum stay as-is
    startHum();

    function frame(now) {
      var elapsed = now - t0;
      var done = elapsed >= SPIN_DURATION;
      var p = done ? 1 : wheelEase(elapsed / SPIN_DURATION);
      var angle = startAngle + (endAngle - startAngle) * p;

      var seg = Math.floor(angle / segAngle);
      if (seg !== lastSeg) {
        var steps = Math.min(8, Math.abs(seg - lastSeg));
        var speed01 = Math.max(0, Math.min(1, Math.abs(angle - lastAngle) / Math.max(0.001, now - lastT) / maxSpeed));
        for (var k = 0; k < steps; k++) playTick(speed01);
        lastSeg = seg;
      }

      var instSpeed = Math.abs(angle - lastAngle) / Math.max(0.001, now - lastT) / maxSpeed;
      updateHum(Math.max(0, Math.min(1, instSpeed)));
      lastAngle = angle;
      lastT = now;

      if (done) {
        stopHum(false);
        // playSeal(); // disabled: no chime on hero landing — ticks/hum stay as-is
        rafId = 0;
        return;
      }
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------
  // Hook the wheel: MutationObserver on .wheel-rotor's inline style.
  // attributeOldValue gives us both endpoints of the rotation in one shot.
  // ---------------------------------------------------------------------
  function attachRotorObserver(rotor) {
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.attributeName !== 'style') continue;
        var newVal = rotor.getAttribute('style');
        var startAngle = parseRotateDeg(m.oldValue);
        var endAngle = parseRotateDeg(newVal);
        if (startAngle === null || endAngle === null) continue;
        if (startAngle === endAngle) continue;
        if (!audioCtx) continue; // no user gesture yet -> stay silent, not an error
        runSpinAudio(startAngle, endAngle);
      }
    });
    observer.observe(rotor, { attributes: true, attributeOldValue: true, attributeFilter: ['style'] });
  }

  function waitForRotor() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var rotor = document.querySelector('.wheel-rotor');
      if (rotor) {
        clearInterval(timer);
        attachRotorObserver(rotor);
      } else if (tries > 40) {
        clearInterval(timer);
      }
    }, 250);
  }
  waitForRotor();

  // ---------------------------------------------------------------------
  // Any click anywhere near the wheel/controls unlocks audio (first-gesture
  // requirement). We don't need to know *which* button — just that a real
  // user gesture happened before spin sound is expected.
  // ---------------------------------------------------------------------
  function unlock() { ensureAudioCtx(); }
  document.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('click', unlock, { capture: true });
  document.addEventListener('keydown', unlock, { capture: true });

  // ===========================================================================
  // MUTE / VOLUME WIDGET
  // ===========================================================================
  var WIDGET_CSS = [
    '.wof-snd-widget{',
    '  display:inline-flex;align-items:center;gap:10px;',
    '  padding:8px 14px;border-radius:10px;position:relative;',
    '  font-family:inherit;',
    '  color:#e9d8a6;',
    '  background:linear-gradient(180deg,rgba(34,18,88,0.6),rgba(17,8,48,0.6));',
    '  border:1px solid rgba(200,170,120,0.35);',
    '  box-shadow:0 0 0 1px rgba(200,170,120,0.1),0 4px 18px rgba(0,0,0,0.4);',
    '  transition:border-color .3s cubic-bezier(0.22,1,0.36,1),box-shadow .3s cubic-bezier(0.22,1,0.36,1);',
    '}',
    '.wof-snd-widget:hover{',
    '  border-color:rgba(230,205,140,0.6);',
    '  box-shadow:0 0 0 1px rgba(230,205,140,0.22),0 8px 22px rgba(0,0,0,0.45);',
    '}',
    '.wof-snd-btn{',
    '  position:relative;overflow:hidden;cursor:pointer;',
    '  width:30px;height:30px;border-radius:8px;flex:0 0 auto;',
    '  display:flex;align-items:center;justify-content:center;',
    '  background:linear-gradient(180deg,rgba(200,170,120,0.14),rgba(200,170,120,0.04));',
    '  border:1px solid rgba(200,170,120,0.3);',
    '  transition:border-color .3s cubic-bezier(0.22,1,0.36,1),transform .3s cubic-bezier(0.22,1,0.36,1);',
    '}',
    '.wof-snd-btn::after{',
    '  content:"";position:absolute;inset:0;pointer-events:none;',
    '  background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,0.45) 48%,rgba(236,216,255,0.8) 52%,rgba(255,255,255,0.45) 56%,transparent 70%);',
    '  background-size:220% 100%;background-position:160% 0;',
    '  mix-blend-mode:overlay;transition:background-position .7s cubic-bezier(0.22,1,0.36,1);',
    '}',
    '.wof-snd-btn:hover{border-color:rgba(230,205,140,0.75);transform:translateY(-1px);}',
    '.wof-snd-btn:hover::after{background-position:-60% 0;}',
    '.wof-snd-btn:active{',
    '  transform:translateY(1px) scale(0.94);',
    '  box-shadow:inset 0 2px 6px rgba(10,5,30,0.5);',
    '  transition:transform .13s cubic-bezier(0.22,1,0.36,1),border-color .13s cubic-bezier(0.22,1,0.36,1),box-shadow .13s cubic-bezier(0.22,1,0.36,1);',
    '}',
    '.wof-snd-icon{',
    '  position:absolute;font-size:15px;line-height:1;',
    '  transition:opacity .3s cubic-bezier(0.22,1,0.36,1),transform .3s cubic-bezier(0.34,1.56,0.64,1);',
    '}',
    '.wof-snd-icon.hide{opacity:0;transform:scale(0.6) rotate(90deg);}',
    '.wof-snd-icon.show{opacity:1;transform:scale(1) rotate(0deg);}',
    '.wof-snd-slider{',
    '  -webkit-appearance:none;appearance:none;',
    '  width:78px;height:4px;border-radius:3px;',
    '  background:linear-gradient(90deg,rgba(230,205,140,0.85) var(--wof-snd-pct,40%),rgba(200,170,120,0.18) var(--wof-snd-pct,40%));',
    '  outline:none;cursor:pointer;',
    '}',
    '.wof-snd-slider::-webkit-slider-thumb{',
    '  -webkit-appearance:none;appearance:none;',
    '  width:12px;height:12px;border-radius:50%;',
    '  background:linear-gradient(180deg,#e9d8a6,#c8a95f);',
    '  border:1px solid rgba(255,255,255,0.6);',
    '  box-shadow:0 1px 4px rgba(0,0,0,0.5);',
    '  transition:transform .2s cubic-bezier(0.22,1,0.36,1);',
    '}',
    '.wof-snd-slider::-webkit-slider-thumb:hover{transform:scale(1.15);}',
    '.wof-snd-slider::-moz-range-thumb{',
    '  width:12px;height:12px;border-radius:50%;border:1px solid rgba(255,255,255,0.6);',
    '  background:linear-gradient(180deg,#e9d8a6,#c8a95f);box-shadow:0 1px 4px rgba(0,0,0,0.5);',
    '}',
    '.wof-snd-widget.is-muted .wof-snd-slider{opacity:0.4;}'
  ].join('\n');

  function injectWidgetCss() {
    if (document.getElementById('wof-snd-css')) return;
    var st = document.createElement('style');
    st.id = 'wof-snd-css';
    st.textContent = WIDGET_CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  function buildWidget() {
    injectWidgetCss();

    var widget = el('div', 'wof-snd-widget');
    widget.id = 'wof-snd-widget';

    var btn = el('button', 'wof-snd-btn');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle sound');
    var iconOn = el('span', 'wof-snd-icon show');
    iconOn.textContent = '🔊'; // speaker
    var iconOff = el('span', 'wof-snd-icon hide');
    iconOff.textContent = '🔇'; // muted speaker
    btn.appendChild(iconOn);
    btn.appendChild(iconOff);

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'wof-snd-slider';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(volume * 100));
    slider.style.setProperty('--wof-snd-pct', slider.value + '%');
    slider.setAttribute('aria-label', 'Sound volume');

    function refreshUI() {
      iconOn.className = 'wof-snd-icon ' + (muted ? 'hide' : 'show');
      iconOff.className = 'wof-snd-icon ' + (muted ? 'show' : 'hide');
      widget.classList.toggle('is-muted', muted);
    }
    refreshUI();

    btn.addEventListener('click', function () {
      ensureAudioCtx();
      muted = !muted;
      applyVolume();
      refreshUI();
    });

    slider.addEventListener('input', function () {
      ensureAudioCtx();
      volume = Math.max(0, Math.min(1, parseInt(slider.value, 10) / 100));
      slider.style.setProperty('--wof-snd-pct', slider.value + '%');
      if (volume > 0 && muted) { muted = false; refreshUI(); }
      applyVolume();
    });

    widget.appendChild(btn);
    widget.appendChild(slider);
    return widget;
  }

  function injectWidget() {
    if (document.getElementById('wof-snd-widget')) return true;
    var widget = buildWidget();
    var host = document.querySelector('.secondary-controls')
            || document.querySelector('.controls')
            || (document.getElementById('spin-btn') && document.getElementById('spin-btn').parentNode);
    if (host) {
      host.appendChild(widget);
      return true;
    }
    return false;
  }

  var tries = 0;
  var widgetTimer = setInterval(function () {
    tries++;
    if (injectWidget() || tries > 40) {
      clearInterval(widgetTimer);
      if (!document.getElementById('wof-snd-widget')) {
        var widget = buildWidget();
        widget.style.cssText = 'position:fixed;top:16px;right:210px;z-index:99999;';
        document.body.appendChild(widget);
      }
    }
  }, 250);

  console.info(
    '[Wheel of Fate] sound patch ready (synthesized Web Audio, no files).',
    reducedMotion ? 'prefers-reduced-motion: audio dampened.' : ''
  );
})();
