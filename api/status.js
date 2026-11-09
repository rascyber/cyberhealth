// GET /api/status?code=...  Tells the site whether live AI is available for this visitor.
import { keyConfigured, validCode, send, MODEL } from './_lib.js';

export default function handler(req, res) {
  const url = new URL(req.url, 'http://local');
  const code = url.searchParams.get('code') || '';
  const key = keyConfigured();
  const ok = key && validCode(code);
  send(res, 200, { ai: ok, keyConfigured: key, codeValid: code ? validCode(code) : null, model: ok ? MODEL : null });
}
