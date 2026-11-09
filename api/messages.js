// POST /api/messages  Live AI for the demo, only with a valid demo access code (header x-demo-code).
// The AI key stays on the server; browsers never see it.
import { API_URL, MODEL, FAST_MODEL, keyConfigured, validCode, rateLimited, send, cleanMessages } from './_lib.js';

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;          // Vercel parses JSON for us
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 8 * 1024 * 1024) throw new Error('too large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!keyConfigured()) return send(res, 503, { error: 'Live AI is not configured on this server.' });
  const code = String(req.headers['x-demo-code'] || '');
  if (!validCode(code)) return send(res, 401, { error: 'Live AI needs a valid demo access code.' });
  if (rateLimited(code)) return send(res, 429, { error: 'Demo limit reached for this hour. Try again later.' });

  let body;
  try { body = await readJson(req); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
  const messages = cleanMessages(body.messages);
  if (!messages) return send(res, 400, { error: 'Bad request' });

  const payload = {
    model: body.tier === 'fast' ? FAST_MODEL : MODEL,
    max_tokens: Math.min(parseInt(body.maxTokens, 10) || 4096, 4096),
    messages
  };
  if (Array.isArray(body.tools) && body.tools.length && body.tools.length <= 20) payload.tools = body.tools;

  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY.trim(), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('AI provider error', r.status, j && j.error && j.error.message);
      return send(res, r.status === 429 ? 429 : 502, { error: r.status === 429 ? 'The AI service is busy. Try again shortly.' : 'The AI service returned an error.' });
    }
    return send(res, 200, { content: j.content || [], stop_reason: j.stop_reason });
  } catch (e) {
    console.error('AI request failed', e.message);
    return send(res, 502, { error: 'Could not reach the AI service.' });
  }
}
