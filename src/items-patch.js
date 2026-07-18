// === Wheel of Fate items patch (7.41c) ====================================
// Pool: Accessories/Support/Magical/Armor/Weapons/Armaments only,
// final-form, > 2000g (boots & Essence Distiller exempt).
// Rules per roll: 1 boots + (0-1) blink + others to 6, no duplicates.
//
// v2: adds a "Configure pool" panel. A gold button injected next to the
// wheel opens a modal grid (Boots / Blinks / Others). Click an item icon to
// toggle whether it can be rolled. Selection is in-memory only and resets to
// "all enabled" on page reload (by design). Rolls draw only from enabled
// items; guards keep at least one boots available so a roll never breaks.
(function () {
  var BOOTS = [{n:"Phase Boots",s:"phase_boots"},{n:"Power Treads",s:"power_treads"},{n:"Boots of Travel",s:"travel_boots_2"},{n:"Boots of Bearing",s:"boots_of_bearing"},{n:"Guardian Greaves",s:"guardian_greaves"}];
  var BLINKS = [{n:"Swift Blink",s:"swift_blink"},{n:"Arcane Blink",s:"arcane_blink"},{n:"Overwhelming Blink",s:"overwhelming_blink"}];
  var OTHERS = [{n:"Hand of Midas",s:"hand_of_midas"},{n:"Moon Shard",s:"moon_shard"},{n:"Essence Distiller",s:"essence_distiller"},{n:"Glimmer Cape",s:"glimmer_cape"},{n:"Holy Locket",s:"holy_locket"},{n:"Solar Crest",s:"solar_crest"},{n:"Spirit Vessel",s:"spirit_vessel"},{n:"Pipe of Insight",s:"pipe"},{n:"Aether Lens",s:"aether_lens"},{n:"Eul's Scepter",s:"cyclone"},{n:"Meteor Hammer",s:"meteor_hammer"},{n:"Gleipnir",s:"gungir"},{n:"Bloodstone",s:"bloodstone"},{n:"Crella's Crozier",s:"crellas_crozier"},{n:"Octarine Core",s:"octarine_core"},{n:"Refresher Orb",s:"refresher"},{n:"Ethereal Blade",s:"ethereal_blade"},{n:"Scythe of Vyse",s:"sheepstick"},{n:"Khanda",s:"angels_demise"},{n:"Bloodthorn",s:"bloodthorn"},{n:"Wind Waker",s:"wind_waker"},{n:"Dagon 5",s:"dagon_5"},{n:"Vladmir's Offering",s:"vladmir"},{n:"Blade Mail",s:"blade_mail"},{n:"Armlet of Mordiggian",s:"armlet"},{n:"Consecrated Wraps",s:"consecrated_wraps"},{n:"Aeon Disk",s:"aeon_disk"},{n:"Crimson Guard",s:"crimson_guard"},{n:"Lotus Orb",s:"lotus_orb"},{n:"Black King Bar",s:"black_king_bar"},{n:"Shiva's Guard",s:"shivas_guard"},{n:"Linken's Sphere",s:"sphere"},{n:"Assault Cuirass",s:"assault"},{n:"Heart of Tarrasque",s:"heart"},{n:"Helm of the Overlord",s:"helm_of_the_overlord"},{n:"Mage Slayer",s:"mage_slayer"},{n:"Revenant's Brooch",s:"revenants_brooch"},{n:"Heaven's Halberd",s:"heavens_halberd"},{n:"Desolator",s:"desolator"},{n:"Battle Fury",s:"bfury"},{n:"Nullifier",s:"nullifier"},{n:"Manta Style",s:"manta"},{n:"Radiance",s:"radiance"},{n:"Monkey King Bar",s:"monkey_king_bar"},{n:"Satanic",s:"satanic"},{n:"Daedalus",s:"greater_crit"},{n:"Butterfly",s:"butterfly"},{n:"Mjollnir",s:"mjollnir"},{n:"Divine Rapier",s:"rapier"},{n:"Silver Edge",s:"silver_edge"},{n:"Aghanim Scepter",s:"ultimate_scepter"},{n:"Abyssal Blade",s:"abyssal_blade"},{n:"Kaya and Sange",s:"kaya_and_sange"},{n:"Sange and Yasha",s:"sange_and_yasha"},{n:"Yasha and Kaya",s:"yasha_and_kaya"},{n:"Hurricane Pike",s:"hurricane_pike"},{n:"Harpoon",s:"harpoon"},{n:"Hydra's Breath",s:"hydras_breath"},{n:"Eye of Skadi",s:"skadi"},{n:"Parasma",s:"devastator"},{n:"Disperser",s:"disperser"}];

  var SLUG_BY_NAME = {};
  function add(arr) { for (var i = 0; i < arr.length; i++) SLUG_BY_NAME[arr[i].n] = arr[i].s; }
  add(BOOTS); add(BLINKS); add(OTHERS);

  // Expose canonical item slugs to the app. The app resolves item icons from
  // dotaconstants first and uses these only as a fallback (e.g. "Eul's Scepter"
  // -> cyclone, "Dagon 5" -> dagon_5). We deliberately do NOT monkeypatch the
  // <img> src setter anymore: React reuses image nodes across re-renders, and an
  // alt-keyed override raced the src/alt update order and swapped icons
  // (e.g. Wind Waker showing Tranquil Boots). dotaconstants already returns the
  // correct, canonical URL for every item in the pool.
  window.ITEM_SLUGS = SLUG_BY_NAME;

  var CDN = "https://cdn.cloudflare.steamstatic.com";
  function itemIconUrl(slug) {
    return CDN + '/apps/dota2/images/dota_react/items/' + slug + '.png';
  }

  // --- Enabled-pool state ---------------------------------------------------
  // A Set of item names currently allowed to roll. Starts with everything on.
  // In-memory only: reloading the page resets to all-enabled (by design).
  var ENABLED = {};
  function enableAll() {
    ENABLED = {};
    [BOOTS, BLINKS, OTHERS].forEach(function (arr) {
      arr.forEach(function (it) { ENABLED[it.n] = true; });
    });
  }
  enableAll();
  window.ENABLED_ITEMS = ENABLED;

  function enabledOf(arr) {
    return arr.filter(function (it) { return ENABLED[it.n]; });
  }

  // --- Roll: 1 boots + (0-1) blink + 4-5 others, no dupes, shuffled --------
  // Now draws only from ENABLED items. Guards:
  //  - if all boots are disabled, fall back to the full boots list (a roll
  //    must always contain exactly one boots), and flag it in the panel.
  //  - if enabled others can't fill 6 slots, the roll just returns fewer.
  function rollItems() {
    var slots = [];

    var boots = enabledOf(BOOTS);
    var bootsPool = boots.length ? boots : BOOTS; // never empty
    slots.push(bootsPool[Math.floor(Math.random() * bootsPool.length)].n);

    var blinks = enabledOf(BLINKS);
    if (blinks.length && Math.random() < 0.5) {
      slots.push(blinks[Math.floor(Math.random() * blinks.length)].n);
    }

    var pool = enabledOf(OTHERS);
    while (slots.length < 6 && pool.length) {
      var idx = Math.floor(Math.random() * pool.length);
      slots.push(pool.splice(idx, 1)[0].n);
    }

    for (var i = slots.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = slots[i]; slots[i] = slots[j]; slots[j] = tmp;
    }
    return slots;
  }

  // Sentinel array so the App's pickN(window.ITEMS, 6) yields our rolls.
  var sentinel = []
    .concat(BOOTS.map(function (x) { return x.n; }))
    .concat(BLINKS.map(function (x) { return x.n; }))
    .concat(OTHERS.map(function (x) { return x.n; }));
  sentinel.slice = function () {
    if (arguments.length === 0) return rollItems();
    return Array.prototype.slice.apply(this, arguments);
  };

  window.BOOTS = BOOTS.map(function (x) { return x.n; });
  window.BLINKS = BLINKS.map(function (x) { return x.n; });
  window.ITEMS = sentinel;
  window.rollItems = rollItems;

  // ==========================================================================
  // POOL SELECTOR PANEL
  // ==========================================================================
  // Self-contained UI: injects its own button, modal, and styles. Clicking an
  // item icon toggles ENABLED[name]. Purely additive to the React app — it
  // never touches the app's own render tree.

  var PANEL_CSS = [
    '.wof-pool-btn{',
    '  display:inline-flex;align-items:center;gap:8px;cursor:pointer;',
    '  font-family:inherit;font-size:0.95rem;letter-spacing:0.02em;',
    '  padding:10px 18px;border-radius:10px;position:relative;overflow:hidden;',
    '  color:#e9d8a6;',
    '  background:linear-gradient(180deg,rgba(34,18,88,0.6),rgba(17,8,48,0.6));',
    '  border:1px solid rgba(200,170,120,0.35);',
    '  box-shadow:0 0 0 1px rgba(200,170,120,0.1),0 4px 18px rgba(0,0,0,0.4);',
    '  transition:border-color .3s cubic-bezier(0.22,1,0.36,1),transform .3s cubic-bezier(0.22,1,0.36,1),box-shadow .3s cubic-bezier(0.22,1,0.36,1);',
    '}',
    '.wof-pool-btn::after{',
    '  content:"";position:absolute;inset:0;pointer-events:none;',
    '  background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,0.45) 48%,rgba(236,216,255,0.8) 52%,rgba(255,255,255,0.45) 56%,transparent 70%);',
    '  background-size:220% 100%;background-position:160% 0;',
    '  mix-blend-mode:overlay;transition:background-position .7s cubic-bezier(0.22,1,0.36,1);',
    '}',
    '.wof-pool-btn:hover{',
    '  border-color:rgba(230,205,140,0.75);transform:translateY(-2px);',
    '  box-shadow:0 0 0 1px rgba(230,205,140,0.3),0 8px 26px rgba(0,0,0,0.5),0 0 30px rgba(200,170,120,0.25);',
    '}',
    '.wof-pool-btn:hover::after{background-position:-60% 0;}',
    '.wof-pool-btn:active{transform:translateY(1px);}',

    '.wof-overlay{',
    '  position:fixed;inset:0;z-index:100000;',
    // Dense enough to fully hide whatever's behind it — including the big
    // hero portrait render on the reveal screen — not just the plain wheel.
    '  background:radial-gradient(ellipse 80% 60% at 50% 20%,rgba(90,26,128,0.45),transparent 60%),rgba(6,3,20,0.94);',
    '  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
    '  display:flex;align-items:center;justify-content:center;padding:24px;',
    '  animation:wofOverlayIn .3s ease-out both;',
    '}',
    '@keyframes wofOverlayIn{from{opacity:0;}to{opacity:1;}}',
    '.wof-modal{',
    '  width:min(920px,96vw);max-height:88vh;overflow:hidden;',
    '  display:flex;flex-direction:column;',
    '  background:linear-gradient(180deg,#1c1044,#0d0726 60%,#0a0620);',
    '  border:1px solid rgba(200,170,120,0.3);border-radius:16px;',
    '  box-shadow:0 24px 80px rgba(0,0,0,0.6),0 0 90px rgba(160,111,245,0.12),inset 0 1px 0 rgba(232,216,255,0.08);',
    '  color:#ece6ff;font-family:inherit;',
    '  animation:wofModalIn .4s cubic-bezier(0.22,1,0.36,1) both;',
    '}',
    '@keyframes wofModalIn{from{opacity:0;transform:scale(0.94) translateY(14px);}to{opacity:1;transform:scale(1) translateY(0);}}',
    '.wof-modal-head{',
    '  display:flex;align-items:center;justify-content:space-between;',
    '  padding:18px 22px;border-bottom:1px solid rgba(200,170,120,0.18);',
    '}',
    '.wof-modal-title{font-size:1.25rem;color:#e9d8a6;letter-spacing:0.03em;}',
    '.wof-modal-sub{font-size:0.82rem;color:#9a8cc0;margin-top:2px;}',
    '.wof-x{cursor:pointer;font-size:1.4rem;line-height:1;color:#9a8cc0;',
    '  background:none;border:none;padding:6px 10px;border-radius:8px;',
    '  transition:color .2s cubic-bezier(0.22,1,0.36,1),background .2s cubic-bezier(0.22,1,0.36,1),transform .2s cubic-bezier(0.22,1,0.36,1);}',
    '.wof-x:hover{color:#fff;background:rgba(255,255,255,0.06);transform:rotate(90deg);}',

    '.wof-body{overflow-y:auto;padding:8px 22px 22px;}',
    '.wof-section{margin-top:18px;}',
    '.wof-section-head{',
    '  display:flex;align-items:center;justify-content:space-between;',
    '  margin-bottom:10px;',
    '}',
    '.wof-section-title{font-size:1rem;color:#c8b6ff;letter-spacing:0.04em;',
    '  text-transform:uppercase;}',
    '.wof-section-actions{display:flex;gap:6px;}',
    '.wof-mini{cursor:pointer;font-size:0.72rem;padding:4px 10px;border-radius:6px;',
    '  color:#c8b6ff;background:rgba(120,90,220,0.12);',
    '  border:1px solid rgba(160,140,220,0.25);',
    '  transition:background .25s cubic-bezier(0.22,1,0.36,1),transform .25s cubic-bezier(0.22,1,0.36,1);}',
    '.wof-mini:hover{background:rgba(120,90,220,0.24);transform:translateY(-1px);}',

    '.wof-grid{',
    '  display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));',
    '  gap:8px;',
    '}',
    '.wof-item{',
    '  position:relative;cursor:pointer;border-radius:8px;padding:6px 4px 5px;',
    '  display:flex;flex-direction:column;align-items:center;gap:5px;',
    '  border:1px solid rgba(160,140,220,0.15);',
    '  background:rgba(255,255,255,0.02);',
    '  transition:border-color .25s cubic-bezier(0.22,1,0.36,1),background .25s cubic-bezier(0.22,1,0.36,1),',
    '    opacity .3s cubic-bezier(0.22,1,0.36,1),transform .25s cubic-bezier(0.22,1,0.36,1),box-shadow .25s cubic-bezier(0.22,1,0.36,1);',
    // fill-mode is "backwards" only (not "both"): "backwards" still avoids a
    // flash of the un-animated tile during the nth-child stagger delay, but
    // — unlike "both" — it lets go of `opacity`/`transform` once the 0.4s
    // entrance finishes, instead of holding opacity:1 forever. With "both"
    // here, that held opacity:1 outranked `.wof-item.off{opacity:0.32}` in
    // the cascade, so disabled tiles never actually dimmed.
    '  animation:wofItemIn .4s cubic-bezier(0.22,1,0.36,1) backwards;',
    '}',
    '@keyframes wofItemIn{from{opacity:0;transform:translateY(10px) scale(0.94);}to{opacity:1;transform:translateY(0) scale(1);}}',
    '.wof-item:nth-child(8n+1){animation-delay:150ms;}',
    '.wof-item:nth-child(8n+2){animation-delay:195ms;}',
    '.wof-item:nth-child(8n+3){animation-delay:240ms;}',
    '.wof-item:nth-child(8n+4){animation-delay:285ms;}',
    '.wof-item:nth-child(8n+5){animation-delay:330ms;}',
    '.wof-item:nth-child(8n+6){animation-delay:375ms;}',
    '.wof-item:nth-child(8n+7){animation-delay:420ms;}',
    '.wof-item:nth-child(8n){animation-delay:465ms;}',
    '.wof-item:hover{border-color:rgba(200,170,120,0.5);transform:translateY(-3px);box-shadow:0 8px 18px rgba(0,0,0,0.35);}',
    '.wof-ico{',
    '  width:64px;height:48px;border-radius:5px;',
    '  background-size:cover;background-position:center;',
    '  box-shadow:0 1px 4px rgba(0,0,0,0.4);',
    '  transition:transform .3s cubic-bezier(0.34,1.56,0.64,1);',
    '}',
    '.wof-name{font-size:0.66rem;line-height:1.15;text-align:center;',
    '  color:#cfc4ec;max-width:80px;transition:color .3s cubic-bezier(0.22,1,0.36,1);}',
    '.wof-item.off{opacity:0.32;filter:grayscale(1);}',
    '.wof-item.off .wof-ico{transform:scale(0.88) rotate(-8deg);}',
    '.wof-item.off .wof-name{color:#7a6aa8;}',
    '.wof-check{',
    '  position:absolute;top:4px;right:4px;width:16px;height:16px;border-radius:50%;',
    '  display:flex;align-items:center;justify-content:center;font-size:11px;',
    '  background:rgba(120,220,160,0.9);color:#08260f;font-weight:700;',
    '  transform:scale(1) rotate(0deg);',
    '  transition:transform .3s cubic-bezier(0.34,1.56,0.64,1),background .3s ease,color .3s ease;',
    '}',
    '.wof-item.off .wof-check{background:rgba(120,90,120,0.5);color:transparent;transform:scale(0.8) rotate(-160deg);}',

    '.wof-warn{',
    '  margin-top:0;padding:0 14px;border-radius:8px;font-size:0.82rem;',
    '  background:rgba(120,40,40,0.25);border:1px solid rgba(220,120,120,0.4);',
    '  color:#ffb8b8;',
    '  max-height:0;opacity:0;overflow:hidden;border-width:0;',
    '  transition:max-height .3s cubic-bezier(0.22,1,0.36,1),opacity .3s cubic-bezier(0.22,1,0.36,1),',
    '    margin-top .3s cubic-bezier(0.22,1,0.36,1),padding .3s cubic-bezier(0.22,1,0.36,1),border-width .3s cubic-bezier(0.22,1,0.36,1);',
    '}',
    '.wof-warn.show{',
    '  margin-top:14px;padding:10px 14px;max-height:80px;opacity:1;border-width:1px;',
    '}',
    '.wof-foot{',
    '  padding:14px 22px;border-top:1px solid rgba(200,170,120,0.18);',
    '  display:flex;align-items:center;justify-content:space-between;',
    '  font-size:0.8rem;color:#9a8cc0;',
    '}',
    '.wof-foot .wof-count{color:#c8b6ff;}',
    '.wof-done{cursor:pointer;padding:9px 22px;border-radius:9px;position:relative;overflow:hidden;',
    '  color:#08260f;font-weight:600;letter-spacing:0.03em;',
    '  background:linear-gradient(180deg,#e9d8a6,#c8a95f);border:none;',
    '  box-shadow:0 4px 14px rgba(0,0,0,0.35);',
    '  transition:filter .25s cubic-bezier(0.22,1,0.36,1),transform .25s cubic-bezier(0.22,1,0.36,1),box-shadow .25s cubic-bezier(0.22,1,0.36,1);}',
    '.wof-done:hover{filter:brightness(1.08);transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,0.45);}',
    '.wof-done:active{transform:translateY(0);}'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('wof-pool-css')) return;
    var st = document.createElement('style');
    st.id = 'wof-pool-css';
    st.textContent = PANEL_CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function makeSection(title, arr) {
    var sec = el('div', 'wof-section');
    var head = el('div', 'wof-section-head');
    head.appendChild(el('div', 'wof-section-title', title));
    var actions = el('div', 'wof-section-actions');
    var allBtn = el('button', 'wof-mini', 'Усі');
    var noneBtn = el('button', 'wof-mini', 'Жодного');
    actions.appendChild(allBtn);
    actions.appendChild(noneBtn);
    head.appendChild(actions);
    sec.appendChild(head);

    var grid = el('div', 'wof-grid');
    sec.appendChild(grid);

    arr.forEach(function (it) {
      var cell = el('div', 'wof-item' + (ENABLED[it.n] ? '' : ' off'));
      cell.setAttribute('data-name', it.n);
      var ico = el('div', 'wof-ico');
      ico.style.backgroundImage = "url('" + itemIconUrl(it.s) + "')";
      var check = el('div', 'wof-check', '\u2713');
      var name = el('div', 'wof-name', it.n);
      cell.appendChild(ico);
      cell.appendChild(check);
      cell.appendChild(name);
      cell.addEventListener('click', function () {
        ENABLED[it.n] = !ENABLED[it.n];
        cell.classList.toggle('off', !ENABLED[it.n]);
        refreshFooter();
      });
      grid.appendChild(cell);
    });

    allBtn.addEventListener('click', function () {
      arr.forEach(function (it) { ENABLED[it.n] = true; });
      Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('off'); });
      refreshFooter();
    });
    noneBtn.addEventListener('click', function () {
      arr.forEach(function (it) { ENABLED[it.n] = false; });
      Array.prototype.forEach.call(grid.children, function (c) { c.classList.add('off'); });
      refreshFooter();
    });

    return sec;
  }

  var footerCountEl, warnEl;
  function countEnabled() {
    var n = 0;
    [BOOTS, BLINKS, OTHERS].forEach(function (arr) {
      arr.forEach(function (it) { if (ENABLED[it.n]) n++; });
    });
    return n;
  }
  // Reuses the single warning strip for both messages (they're mutually
  // exclusive: 0 boots implies 0 total too, so the broader "nothing enabled"
  // hint always takes priority when it applies).
  function refreshFooter() {
    var total = countEnabled();
    if (footerCountEl) footerCountEl.textContent = total + ' предметів увімкнено';
    if (warnEl) {
      var noBoots = enabledOf(BOOTS).length === 0;
      if (total === 0) {
        warnEl.textContent = '⚠ Не обрано жодного предмета — випаде випадковий набір.';
        warnEl.classList.add('show');
      } else if (noBoots) {
        warnEl.textContent = '⚠ Усі черевики вимкнено — ролл усе одно візьме випадкові черевики, бо кожен набір потребує рівно одну пару.';
        warnEl.classList.add('show');
      } else {
        warnEl.classList.remove('show');
      }
    }
  }

  function openPanel() {
    injectCss();
    var overlay = el('div', 'wof-overlay');
    var modal = el('div', 'wof-modal');

    var head = el('div', 'wof-modal-head');
    var titleWrap = el('div');
    titleWrap.appendChild(el('div', 'wof-modal-title', 'Налаштувати пул предметів'));
    titleWrap.appendChild(el('div', 'wof-modal-sub', 'Оберіть, які предмети можуть випадати. Скидається при перезавантаженні.'));
    head.appendChild(titleWrap);
    var x = el('button', 'wof-x', '\u00d7');
    head.appendChild(x);
    modal.appendChild(head);

    var body = el('div', 'wof-body');
    body.appendChild(makeSection('Черевики', BOOTS));
    body.appendChild(makeSection('Блінки', BLINKS));
    body.appendChild(makeSection('Інші предмети', OTHERS));

    warnEl = el('div', 'wof-warn', '\u26a0 Усі черевики вимкнено — ролл усе одно візьме випадкові черевики, бо кожен набір потребує рівно одну пару.');
    body.appendChild(warnEl);
    modal.appendChild(body);

    var foot = el('div', 'wof-foot');
    footerCountEl = el('div', 'wof-count');
    foot.appendChild(footerCountEl);
    var done = el('button', 'wof-done', 'Готово');
    foot.appendChild(done);
    modal.appendChild(foot);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    refreshFooter();

    function close() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    x.addEventListener('click', close);
    done.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  }
  window.openItemPool = openPanel;

  // --- Inject the "Configure pool" button near the wheel controls ----------
  function injectButton() {
    if (document.getElementById('wof-pool-btn')) return true;
    injectCss();
    var btn = el('button', 'wof-pool-btn');
    btn.id = 'wof-pool-btn';
    btn.innerHTML = '\u2699\ufe0f <span>Налаштувати пул</span>';
    btn.addEventListener('click', openPanel);

    // Prefer to sit alongside the existing secondary controls / spin button.
    var host = document.querySelector('.secondary-controls')
            || document.querySelector('.controls')
            || (document.getElementById('spin-btn') && document.getElementById('spin-btn').parentNode);
    if (host) {
      host.appendChild(btn);
      return true;
    }
    return false;
  }

  // The React app mounts asynchronously; retry until the controls exist, then
  // stop. Falls back to a fixed-position button if nothing is found in time.
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (injectButton() || tries > 40) {
      clearInterval(timer);
      if (!document.getElementById('wof-pool-btn')) {
        injectCss();
        var btn = el('button', 'wof-pool-btn');
        btn.id = 'wof-pool-btn';
        btn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;';
        btn.innerHTML = '\u2699\ufe0f <span>Налаштувати пул</span>';
        btn.addEventListener('click', openPanel);
        document.body.appendChild(btn);
      }
    }
  }, 250);

  console.info(
    "[Wheel of Fate] items patched (7.41c + pool selector):",
    BOOTS.length + " boots,",
    BLINKS.length + " blinks,",
    OTHERS.length + " others.",
    "Click 'Налаштувати пул' to choose which items can roll."
  );
})();
