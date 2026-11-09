/*
 * CyberHealth white-label runtime.
 * Every page loads this first. It reads the active brand (preset or custom), sets CSS variables,
 * swaps logos and replaces the product name everywhere, so one build serves any client brand.
 * Powered by Cyber Development (Pty) Ltd.
 */
(function () {
  'use strict';
  var KEY = 'ch.brand';
  var BASE_NAME = 'CyberHealth';

  var PRESETS = {
    cyberhealth: {
      id: 'cyberhealth', name: 'CyberHealth', domain: 'cyberhealth.business',
      tagline: 'The AI co-pilot for South African doctors',
      logo: '/brand/cyberhealth-mark.png',
      colors: { primary: '#1D5F69', accent: '#2A7F8C', soft: '#E2F2F4', navy: '#0B2545' },
      appTheme: null // the clinician app keeps its own original palette
    },
    medmap: {
      id: 'medmap', name: 'MedMap', domain: 'medmap.co.za',
      tagline: 'One health record, from check-in to consult',
      logo: '/brand/medmap-mark.png',
      colors: { primary: '#0B5E52', accent: '#0F7F6E', soft: '#E3F4EF', navy: '#102A3A' }
    }
  };

  // ---------- colour helpers ----------
  function hexToRgb(h) {
    h = String(h || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r) {
    return '#' + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('').toUpperCase();
  }
  function mix(a, b, t) { var x = hexToRgb(a), y = hexToRgb(b); return rgbToHex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function lum(hex) {
    return hexToRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
      .reduce(function (s, v, i) { return s + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) { var la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
  // Darken until white text passes WCAG AA (4.5:1).
  function readableOnWhiteText(hex) {
    var c = hex, i = 0;
    while (contrast(c, '#FFFFFF') < 4.5 && i < 30) { c = mix(c, '#000000', 0.06); i++; }
    return c;
  }

  // Build a full palette from a single brand colour.
  function deriveColors(primaryInput) {
    var accent = readableOnWhiteText(primaryInput);
    var primary = readableOnWhiteText(mix(accent, '#000000', 0.18));
    return { primary: primary, accent: accent, soft: mix(accent, '#FFFFFF', 0.9), navy: mix(accent, '#0B1A26', 0.78) };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var b = JSON.parse(raw);
        if (b && b.id && PRESETS[b.id] && !b.custom) return PRESETS[b.id];
        if (b && b.custom && b.name) return b;
      }
    } catch (e) { /* storage blocked: fall back to default */ }
    var param = new URLSearchParams(location.search).get('brand');
    if (param && PRESETS[param]) return PRESETS[param];
    return PRESETS.cyberhealth;
  }

  var brand = load();

  function save(b) {
    try { localStorage.setItem(KEY, JSON.stringify(b)); sessionStorage.removeItem('ch.inApp'); } catch (e) { /* ignore */ }
  }

  function makeCustom(opts) {
    var colors = deriveColors(opts.color || '#1D5F69');
    return {
      id: 'custom', custom: true, name: (opts.name || 'Your Brand').trim().slice(0, 40),
      domain: (opts.domain || '').trim().slice(0, 80), tagline: (opts.tagline || '').trim().slice(0, 90),
      logo: opts.logo || null, colors: colors, sourceColor: opts.color
    };
  }

  // The clinician app (Expo) theme derived from the brand.
  function appTheme(b) {
    if (b.appTheme === null) return null;
    var c = b.colors;
    return { brand: c.accent, primary: c.accent, primaryDark: c.primary, primarySoft: c.soft, navy: c.navy };
  }

  // ---------- applying the brand to a page ----------
  function setCssVars() {
    var c = brand.colors, s = document.documentElement.style;
    s.setProperty('--brand', c.primary);
    s.setProperty('--brand-2', c.accent);
    s.setProperty('--brand-soft', c.soft);
    s.setProperty('--navy', c.navy);
  }

  var seen = new WeakMap();
  var RX = new RegExp(BASE_NAME, 'g');
  function kept(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    return !!(el && el.closest && el.closest('[data-brand-keep]'));
  }
  function swapText(node) {
    if (brand.name === BASE_NAME || kept(node)) return;
    var v = node.nodeValue;
    if (!v || v.indexOf(BASE_NAME) === -1 || seen.get(node) === v) return;
    var nv = v.replace(RX, brand.name);
    seen.set(node, nv);
    if (nv !== v) node.nodeValue = nv;
  }
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  function swapAttrs(el) {
    if (brand.name === BASE_NAME || !el.getAttribute || kept(el)) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a && a.indexOf(BASE_NAME) !== -1) el.setAttribute(ATTRS[i], a.replace(RX, brand.name));
    }
  }
  function swapLogo(el) {
    if (el.matches && el.matches('img[data-brand-logo]')) {
      var src = brand.logo || PRESETS.cyberhealth.logo;
      if (el.getAttribute('src') !== src) el.setAttribute('src', src);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { swapText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { swapAttrs(root); swapLogo(root); if (root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return; }
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    var n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) {
        var p = n.parentNode;
        if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE' || p.tagName === 'TEXTAREA')) continue;
        swapText(n);
      } else { swapAttrs(n); swapLogo(n); }
    }
  }

  function start() {
    setCssVars();
    if (brand.name !== BASE_NAME) document.title = document.title.replace(RX, brand.name);
    walk(document.body);
    var mo = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var m = list[i];
        if (m.type === 'characterData') swapText(m.target);
        else if (m.type === 'attributes') { swapAttrs(m.target); swapLogo(m.target); }
        else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(['src']) });
  }

  window.addEventListener('storage', function (e) { if (e.key === KEY) location.reload(); });

  window.CHBrand = {
    get: function () { return brand; },
    presets: PRESETS,
    usePreset: function (id) { if (PRESETS[id]) { save({ id: id }); location.reload(); } },
    useCustom: function (opts) { save(makeCustom(opts)); location.reload(); },
    preview: makeCustom,
    appTheme: function () { return appTheme(brand); },
    contrast: contrast,
    deriveColors: deriveColors,
    rename: function (text) { return brand.name === BASE_NAME ? text : String(text).replace(RX, brand.name); },
    exportConfig: function () { return JSON.stringify(brand, null, 2); }
  };

  // The clinician app reads these before its bundle runs.
  globalThis.__CH_THEME__ = appTheme(brand);
  globalThis.__CH_MARK__ = brand.id === 'cyberhealth' ? null : (brand.logo || null);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
