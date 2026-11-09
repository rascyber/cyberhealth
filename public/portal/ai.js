// Live AI for the demo. Visitors see ready-made content; a demo access code switches on live AI.
const CODE_KEY = 'ch.demoCode';

export const getCode = () => { try { return localStorage.getItem(CODE_KEY) || ''; } catch (e) { return ''; } };
export const setCode = c => { try { c ? localStorage.setItem(CODE_KEY, c) : localStorage.removeItem(CODE_KEY); } catch (e) { /* ignore */ } };

let cached = null;
export async function aiStatus(force) {
  if (cached && !force) return cached;
  const code = getCode();
  try {
    const r = await fetch('/api/status' + (code ? '?code=' + encodeURIComponent(code) : ''), { cache: 'no-store' });
    cached = await r.json();
  } catch (e) { cached = { ai: false, keyConfigured: false, codeValid: false, offline: true }; }
  return cached;
}

export async function ask(prompt, { tier = 'default', maxTokens } = {}) {
  const r = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-demo-code': getCode() },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], tier, maxTokens })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'The AI request failed (' + r.status + ').');
  return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

export function parseJson(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { return null; }
}
