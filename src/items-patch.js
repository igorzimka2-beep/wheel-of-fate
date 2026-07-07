// === Wheel of Fate items patch (7.41c) ====================================
// Pool: Accessories/Support/Magical/Armor/Weapons/Armaments only,
// final-form, > 2000g (boots & Essence Distiller exempt).
// Rules per roll: 1 boots + (0-1) blink + others to 6, no duplicates.
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

  // --- Image URL override ---------------------------------------------------
  // Forces canonical Steam CDN slugs regardless of dotaconstants name match.
  // Handles React's render-order race where src is set before alt by deferring
  // a re-check to a microtask after both attributes have been written.
  function seedItemImages() {
    var SLUG_URL = function (slug) {
      return CDN + '/apps/dota2/images/dota_react/items/' + slug + '.png';
    };

    function tryFix(img) {
      try {
        var alt = img.getAttribute('alt');
        if (!alt) return false;
        var slug = SLUG_BY_NAME[alt];
        if (!slug) return false;
        var want = SLUG_URL(slug);
        if (img.getAttribute('src') !== want) {
          nativeSrcSet.call(img, want);
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    var imgProto = HTMLImageElement.prototype;
    var srcDesc = Object.getOwnPropertyDescriptor(imgProto, 'src');
    if (!srcDesc || !srcDesc.set) return;
    var nativeSrcSet = srcDesc.set;
    var nativeSrcGet = srcDesc.get;

    Object.defineProperty(imgProto, 'src', {
      configurable: true,
      get: function () { return nativeSrcGet.call(this); },
      set: function (v) {
        if (typeof v === 'string' && v.indexOf('/dota_react/items/') !== -1) {
          if (tryFix(this)) return;
          nativeSrcSet.call(this, v);
          var img = this;
          Promise.resolve().then(function () { tryFix(img); });
          return;
        }
        nativeSrcSet.call(this, v);
      },
    });

    var origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      var ret = origSetAttr.call(this, name, value);
      if (this.tagName === 'IMG' && name === 'src'
          && typeof value === 'string'
          && value.indexOf('/dota_react/items/') !== -1) {
        if (!tryFix(this)) {
          var img = this;
          Promise.resolve().then(function () { tryFix(img); });
        }
      }
      if (this.tagName === 'IMG' && name === 'alt') tryFix(this);
      return ret;
    };

    function fixAll() {
      var imgs = document.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) tryFix(imgs[i]);
    }
    if (document.body) fixAll();
    else document.addEventListener('DOMContentLoaded', fixAll);
  }
  // seedItemImages() is intentionally NOT called — see window.ITEM_SLUGS note
  // above. The monkeypatch it installs caused item-icon swaps under React
  // re-renders, and dotaconstants already provides correct item images.

  // --- Roll: 1 boots + (0-1) blink + 4-5 others, no dupes, shuffled -------
  function rollItems() {
    var slots = [];
    slots.push(BOOTS[Math.floor(Math.random() * BOOTS.length)].n);
    if (Math.random() < 0.5) {
      slots.push(BLINKS[Math.floor(Math.random() * BLINKS.length)].n);
    }
    var pool = OTHERS.slice();
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

  console.info(
    "[Wheel of Fate] items patched (7.41c):",
    BOOTS.length + " boots,",
    BLINKS.length + " blinks,",
    OTHERS.length + " others.",
    "Each roll: 1 boots + (0-1) blink + others, no dupes."
  );
})();