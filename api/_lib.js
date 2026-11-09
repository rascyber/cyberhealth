// Shared helpers for the CyberHealth demo API (Vercel functions and the local server).
import { timingSafeEqual } from 'node:crypto';

export const MODEL = process.env.CYBERHEALTH_MODEL || 'claude-sonnet-5-5';
export const FAST_MODEL = process.env.CYBERHEALTH_FAST_MODEL || 'claude-haiku-5-5';
export const API_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages';
export const keyConfigured = () => Boolean((process.env.ANTHROPIC_API_KEY || '').trim());

const codes = () => (process.env.DEMO_ACCESS_CODES || '').split(',').map(s => s.trim()).filter(Boolean);

export function validCode(code) {
  if (!code || typeof code !== 'string' || code.length > 100) return false;
  const a = Buffer.from(code);
  return codes().some(c => { const b = Buffer.from(c); return a.length === b.length && timingSafeEqual(a, b); });
}

// Best-effort limit per access code (per server instance). Vercel may run several instances,
// so set a monthly spend limit on the AI account as the real backstop.
const buckets = new Map();
export function rateLimited(key) {
  const limit = parseInt(process.env.RATE_LIMIT_PER_HOUR || '150', 10);
  const now = Date.now(); const hour = 3600000;
  const b = buckets.get(key) || { start: now, n: 0 };
  if (now - b.start > hour) { b.start = now; b.n = 0; }
  b.n++; buckets.set(key, b);
  return b.n > limit;
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// Only pass through what the demo needs.
export function cleanMessages(messages) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 60) return null;
  const out = [];
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null;
    if (typeof m.content !== 'string' && !Array.isArray(m.content)) return null;
    out.push({ role: m.role, content: m.content });
  }
  return out;
}
