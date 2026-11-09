/*
 * CyberHealth clinician app: AI bridge for cyberhealth.business.
 * The app asks globalThis.claude.use('sample') for an AI function. This provides one that calls the
 * site's /api/messages (AI key kept server-side) when the visitor has entered a demo access code.
 * Tool calls (AI front desk, Ask CyberHealth) run here in the browser against the demo data.
 */
(function () {
  var CODE_KEY = 'ch.demoCode';
  function code() { try { return localStorage.getItem(CODE_KEY) || ''; } catch (e) { return ''; } }
  try { sessionStorage.setItem('ch.inApp', '1'); } catch (e) { /* ignore */ }

  var statusPromise = null;
  function status() {
    if (!statusPromise) {
      var c = code();
      statusPromise = fetch('/api/status' + (c ? '?code=' + encodeURIComponent(c) : ''), { cache: 'no-store' })
        .then(function (r) { return r.json(); }).catch(function () { return { ai: false }; });
    }
    return statusPromise;
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = reject; fr.readAsDataURL(blob);
    });
  }
  async function imageBlocks(images) {
    var out = [];
    for (var i = 0; i < (images || []).length; i++) {
      var im = images[i], mime = 'image/jpeg', data = null;
      if (!im) continue;
      if (typeof im === 'string') { if (im.indexOf('data:') === 0) { mime = im.slice(5, im.indexOf(';')); data = im.split(',')[1]; } else data = im; }
      else if (typeof Blob !== 'undefined' && im instanceof Blob) { mime = im.type || mime; data = await blobToBase64(im); }
      else if (im.base64) { data = im.base64; mime = im.mimeType || mime; }
      if (data) out.push({ type: 'image', source: { type: 'base64', media_type: mime, data: data } });
    }
    return out;
  }
  function normalise(messages) {
    var out = [];
    messages.forEach(function (m) {
      var role = m.role === 'assistant' ? 'assistant' : 'user', last = out[out.length - 1];
      if (last && last.role === role && typeof last.content === 'string' && typeof m.content === 'string') last.content += '\n\n' + m.content;
      else out.push({ role: role, content: m.content });
    });
    if (out.length && out[0].role !== 'user') out.unshift({ role: 'user', content: '(The conversation starts.)' });
    return out;
  }
  async function post(body) {
    var r = await fetch('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-code': code() }, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var err = new Error(j.error || ('The AI request failed (' + r.status + ').')); if (r.status === 429) err.code = 'rate_limited'; throw err; }
    return j;
  }
  // The demo prompts mention the base product name; use the active brand's name instead.
  function rebrand(x) { return (window.CHBrand && typeof x === 'string') ? window.CHBrand.rename(x) : x; }

  async function run(prompt, opts) {
    opts = opts || {};
    var messages = typeof prompt === 'string' ? [{ role: 'user', content: rebrand(prompt) }]
      : normalise(prompt.map(function (m) { return { role: m.role, content: rebrand(m.content) }; }));
    if (opts.images && opts.images.length) {
      var imgs = await imageBlocks(opts.images), last = messages[messages.length - 1];
      last.content = imgs.concat([{ type: 'text', text: typeof last.content === 'string' ? last.content : '' }]);
    }
    var tools = (opts.tools || []).map(function (t) {
      return { name: t.name, description: rebrand(t.description || ''), input_schema: t.inputSchema || t.input_schema || { type: 'object', properties: {} } };
    });
    var text = '';
    for (var step = 0; step < 10; step++) {
      var res = await post({ messages: messages, tools: tools, tier: opts.modelTier || 'default' });
      var content = res.content || [];
      var stepText = content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
      if (res.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: content });
        var results = [];
        for (var i = 0; i < content.length; i++) {
          var b = content[i]; if (b.type !== 'tool_use') continue;
          var tool = (opts.tools || []).find(function (t) { return t.name === b.name; }), out;
          try { out = tool ? await tool.execute(b.input || {}) : { error: 'Unknown tool ' + b.name }; } catch (e) { out = { error: String((e && e.message) || e) }; }
          results.push({ type: 'tool_result', tool_use_id: b.id, content: typeof out === 'string' ? out : JSON.stringify(out === undefined ? null : out) });
        }
        messages.push({ role: 'user', content: results });
        continue;
      }
      text = stepText; break;
    }
    if (opts.onText) { try { opts.onText({ text: text }); } catch (e) { /* ignore */ } }
    return { text: text };
  }
  run.limits = async function () { return { images: true }; };

  globalThis.claude = {
    use: async function (name) {
      if (name !== 'sample') return null;
      var s = await status();
      return s.ai ? run : null;
    }
  };

  // Badge beside the app: back to the website, and the demo access code.
  function badge() {
    var b = document.createElement('div');
    b.id = 'ch-badge';
    b.innerHTML = '<a href="/" class="home" title="Back to the website"><img src="/brand/cd-logo.png" alt=""><span><b>CyberHealth demo</b><small>Powered by Cyber Development</small></span></a>' +
      '<a href="/portal" class="lnk">Patient, doctor &amp; employer demo</a>' +
      '<button type="button" class="ai">Live AI: …</button>';
    document.body.appendChild(b);
    b.querySelector('.home').addEventListener('click', function () { try { sessionStorage.removeItem('ch.inApp'); } catch (e) { /* ignore */ } });
    b.querySelector('.lnk').addEventListener('click', function () { try { sessionStorage.removeItem('ch.inApp'); } catch (e) { /* ignore */ } });
    var btn = b.querySelector('.ai');
    status().then(function (s) { btn.textContent = s.ai ? '● Live AI on' : 'Live AI: enter code'; if (s.ai) btn.classList.add('on'); });
    btn.addEventListener('click', function () {
      var c = window.prompt('Demo access code for live AI (leave empty to remove):', code());
      if (c === null) return;
      try { c.trim() ? localStorage.setItem(CODE_KEY, c.trim()) : localStorage.removeItem(CODE_KEY); } catch (e) { /* ignore */ }
      location.reload();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', badge); else badge();
})();
