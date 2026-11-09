#!/usr/bin/env node
// Local / self-hosted server for the CyberHealth demo (Node.js 18+). Vercel does not use this file;
// it serves public/ and the /api functions itself. Run: node server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');

// Settings from .env (local development); real environment variables win on servers.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const { default: status } = await import('./api/status.js');
const { default: messages } = await import('./api/messages.js');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.txt': 'text/plain', '.xml': 'application/xml', '.ico': 'image/x-icon' };
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };

function file(res, f) {
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ...SECURITY });
  fs.createReadStream(f).pipe(res);
}

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/status') return status(req, res);
  if (p === '/api/messages') return messages(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  let f = path.normalize(path.join(PUBLIC, p));
  if (!f.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (fs.existsSync(f) && fs.statSync(f).isFile()) return file(res, f);
  if (p.startsWith('/audio/') || p.startsWith('/brand/') || p.startsWith('/portal/') || p.startsWith('/api/')) { res.writeHead(404, SECURITY); return res.end('Not found'); }
  return file(res, path.join(PUBLIC, 'app', 'index.html'));       // in-app routes of the clinician app
}).listen(PORT, HOST, () => {
  console.log(`\n  CyberHealth demo running on http://localhost:${PORT}`);
  console.log(`  Website /   Demo portal /portal   Clinician app /app`);
  console.log(`  Live AI: ${process.env.ANTHROPIC_API_KEY ? 'key set' : 'no key'}; access codes: ${(process.env.DEMO_ACCESS_CODES || '').split(',').filter(Boolean).length}\n`);
});
