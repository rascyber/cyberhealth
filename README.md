# CyberHealth: white-label demo platform for cyberhealth.business

Technology powered by **Cyber Development (Pty) Ltd** · *We secure what matters.*

This folder is the whole public demo, ready to deploy on **Vercel** at **https://cyberhealth.business**:

| Address | What it is |
|---|---|
| `/` | The CyberHealth website: story, live-demo links, white-label offer, contact form |
| `/portal` | Interactive demo with five views (below) |
| `/app` | The clinician AI co-pilot app (pre-consult brief, AI scribe, safety and claim check, pre-auth, AI front desk) |
| `/api/status`, `/api/messages` | Live AI for visitors who have a demo access code (the AI key stays on the server) |

### The five demo views (`/portal`)

1. **Check-in terminal**: an employee places a finger to check in; attendance is saved, then SpO₂ and pulse go privately to her app (try "low reading" and "poor signal").
2. **Patient app**: check-in vitals (charts and history), appointments (book, cancel), prescriptions (send to pharmacy), doctor's notes and sick notes (printable), consult transcripts, visit summaries (translate with live AI), notifications.
3. **Doctor + Scribe**: Scribe device status (lock remotely), today's recordings, **audio player with synced, searchable transcript**, AI draft (note, ICD-10, script, sick note, follow-up), safety and claim check, patient's shared workplace readings, **Sign and send**, which delivers everything to the patient's app.
4. **Employer**: attendance, terminal status, screening uptake. No health data; certificates arrive only if the employee shares them, without the diagnosis.
5. **White-label studio**: switch to a sample client (MedMap) or create a brand (name, domain, tagline, colour, logo). The website, portal, clinician app and documents all rebrand at once. Download the brand config.

Everything in the demo is fictional. State is kept in each visitor's browser (use **Reset** in the top bar). Dates move with today's date, so the story always looks current.

---

## 1. Deploy to Vercel (about 15 minutes)

**Option A: GitHub (recommended, so changes deploy automatically)**
1. Create a private GitHub repository (e.g. `cyberhealth-site`) and upload the contents of this folder (keep the structure: `api/`, `public/`, `vercel.json`, `package.json`).
2. In Vercel: **Add New → Project → Import** that repository. Framework preset: **Other**. Leave build settings empty (`vercel.json` sets them). Click **Deploy**.

**Option B: Vercel CLI**
```bash
npm i -g vercel
cd cyberhealth-platform
vercel          # first time: log in, create the project
vercel --prod   # publish
```

## 2. Switch on live AI (optional but recommended)

In Vercel: **Project → Settings → Environment Variables** (Production), then redeploy:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your API key from https://console.anthropic.com |
| `DEMO_ACCESS_CODES` | Comma-separated codes you give prospects, e.g. `MEDMAP-NOV,INVESTOR-01,EXPO2026` |
| `RATE_LIMIT_PER_HOUR` | Optional, default `150` AI requests per code per hour |
| `CYBERHEALTH_MODEL` | Optional, default `claude-sonnet-5-5` |

- Visitors without a code see the ready-made demo content (no AI cost).
- With a code (top bar **Live AI** in `/portal`, bottom-right button in `/app`), they can regenerate notes, translate summaries and use the whole clinician app live.
- Give each prospect their own code, and remove it from the list when you're done.
- **Set a monthly spend limit** on the AI account in the console; the per-code limit is a per-server safeguard only.

## 3. Connect cyberhealth.business

1. Vercel: **Project → Settings → Domains → Add** `cyberhealth.business` (accept adding `www.cyberhealth.business` too).
2. At your domain registrar's DNS settings, delete any old `A`/`AAAA` records for `@` and `www`, then add exactly what Vercel's domain card shows, typically:

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | the value on your domain card (e.g. `cname.vercel-dns-0.com`) |

3. Wait for Vercel to show **Valid Configuration**; HTTPS is issued automatically. (If the registrar proxies traffic, e.g. Cloudflare orange cloud, set it to DNS-only until the certificate is issued.)

## 4. Before you share the link

- **Contact address**: the website's contact form opens an email to `sales@cyberhealth.business`. Create that mailbox, or change `CONTACT` near the bottom of `public/index.html`.
- **Real Scribe audio (optional)**: drop recordings in `public/audio/` named `rec-lerato.mp3`, `rec-pieter.mp3`, `rec-nomsa.mp3`. The player uses them automatically and stretches the transcript timing to the recording. Without them, the browser voices the fictional transcript (silent playback with the moving transcript if the browser has no voices).
- **Demo content**: people, readings, transcript, note, script and certificate are in `public/portal/data.js`.
- **Sample brands**: presets live in `public/brand/brand.js` (`PRESETS`); add a client by copying the MedMap entry and adding their square logo to `public/brand/`.

## 5. Run it on your own computer

```bash
cp .env.example .env     # add your key and codes (optional)
node server.js           # Node 18 or newer, nothing to install
```
Open http://localhost:3000. The same `server.js` also runs on a Linux server (behind Nginx or Caddy for HTTPS) if you ever move off Vercel.

## 6. Five-minute demo script

1. **Website**: the story, then *White-label* → click **MedMap (sample client)** to rebrand everything; switch back.
2. **Portal → Check-in terminal**: tap the sensor (tick *low reading* for drama).
3. **Patient app**: the new reading, the alert in the inbox, the chart.
4. **Doctor + Scribe**: play the recording, click a transcript line to jump, show the safety alerts, **Sign and send**.
5. **Patient app**: notifications, summary (translate to isiZulu with a code), transcript, send script to pharmacy, share sick note with HR.
6. **Employer**: attendance only; the certificate without the diagnosis.
7. **Clinician app** (`/app`): AI front desk, pre-auth, Ask CyberHealth (needs a code).

## Good to know

- This is a **sales demo with fictional data**, not the production clinical system. Real deployments add authentication, the clinical database, audit logs and integrations; don't enter real patient information here.
- `/portal` and `/app` are marked `noindex`; only the website is meant for search engines.
- Security headers (HSTS, frame denial, no sniffing, restricted permissions) are set in `vercel.json`. The AI key is only ever used server-side; codes are compared in constant time.
- The clinician app's built-in sample diary is generated for weekdays; on a weekend some doctors' "today" lists are empty. The portal demo is unaffected.
- Google Fonts load online; offline, pages fall back to system fonts.

## Folder

```
api/            Vercel functions: status.js, messages.js (+ _lib.js helpers)
public/         Everything served to browsers
  index.html    Website
  portal/       Demo portal (app.js, data.js, state.js, player.js, ai.js, styles.css)
  app/          Clinician AI co-pilot (index.html) + ai-bridge.js
  brand/        brand.js (white-label runtime), logos
  audio/        Optional real Scribe recordings
server.js       Local / self-hosted server
vercel.json     Hosting, routing and security headers
```
