// CyberHealth demo portal: patient app, doctor workspace, employer dashboard, check-in terminal and white-label studio.
import * as D from './data.js';
import { S } from './state.js';
import { aiStatus, ask, getCode, setCode, parseJson } from './ai.js';
import { ScribePlayer, fmtTime } from './player.js';

const Brand = () => window.CHBrand.get();
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d, o) => new Date(d).toLocaleDateString('en-ZA', o || { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDay = d => new Date(d).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtClock = d => new Date(d).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
function rel(d) {
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const n = Math.round((day - D.today) / 86400000);
  return n === 0 ? 'Today' : n === -1 ? 'Yesterday' : n === 1 ? 'Tomorrow' : n > 1 ? 'In ' + n + ' days' : -n + ' days ago';
}
const doc = id => D.doctors[id];

// ---------------- derived demo data ----------------
const lines = D.timeline(D.consult.transcript);
const kneeLines = D.timeline(D.kneeVisit.transcript);
const otherLines = Object.fromEntries(D.otherRecordings.map(r => [r.id, D.timeline(r.transcript)]));

function checkins() {
  return [...D.baseCheckins(), ...S.get().extraCheckins].sort((a, b) => new Date(b.time) - new Date(a.time));
}
const readings = () => checkins().filter(c => c.spo2 != null);
const certFrom = () => D.at(D.draft.certificate.fromOffset);
const certTo = () => D.at(D.draft.certificate.fromOffset + D.draft.certificate.days - 1);
const followUpWhen = () => D.at(D.draft.followUp.offset, ...D.draft.followUp.time);
const note = () => S.get().noteEdits || D.draft.note;

function notifications() {
  const s = S.get(); const list = [...D.baseNotifications()];
  if (s.signed) {
    const t = s.signedAt;
    list.push(
      { id: 'n-ready', at: t, kind: 'records', title: 'Your visit notes are ready', body: 'Dr Thandi Mokoena signed your record. Read your summary and the transcript of today\'s consult.', link: '#/patient/visit/rec-lerato/summary' },
      { id: 'n-script', at: t, kind: 'script', title: 'Prescription ready', body: 'Salbutamol inhaler and paracetamol. Send it to a pharmacy from the app.', link: '#/patient/visit/rec-lerato/script' },
      { id: 'n-cert', at: t, kind: 'certificate', title: 'Medical certificate issued', body: 'Unfit for work ' + fmtDate(certFrom(), { day: 'numeric', month: 'short' }) + ' to ' + fmtDate(certTo(), { day: 'numeric', month: 'short' }) + '. Share it with HR from the app if you choose.', link: '#/patient/visit/rec-lerato/cert' },
      { id: 'n-fu', at: t, kind: 'appointment', title: 'Follow-up booked', body: 'Dr Thandi Mokoena, ' + fmtDay(followUpWhen()) + ' at ' + fmtClock(followUpWhen()) + '.', link: '#/patient/visits' }
    );
  }
  list.push(...s.extraNotifs);
  return list.sort((a, b) => new Date(b.at) - new Date(a.at));
}
const unread = () => notifications().filter(n => !S.get().readNotifs.includes(n.id)).length;

function appointments() {
  const s = S.get();
  let list = D.baseAppointments();
  if (s.signed) list.push({ id: 'a-fu', with: 'mokoena', when: followUpWhen().toISOString(), status: 'Booked', reason: D.draft.followUp.reason, place: D.practice.name });
  list = list.concat(s.booked);
  return list.map(a => s.cancelled.includes(a.id) ? { ...a, status: 'Cancelled' } : a).sort((a, b) => new Date(a.when) - new Date(b.when));
}

// ---------------- small UI helpers ----------------
function toast(msg, kind) {
  const t = document.createElement('div');
  t.className = 'toast' + (kind ? ' ' + kind : ''); t.setAttribute('role', 'status'); t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 3200); setTimeout(() => t.remove(), 3700);
}
function modal(html) {
  const m = $('#modal'); m.innerHTML = '<div class="scrim" data-action="close-modal"></div><div class="dialog" role="dialog" aria-modal="true">' + html + '</div>';
  m.hidden = false; const f = m.querySelector('input,select,button:not([data-action=close-modal])'); if (f) f.focus();
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }

const ICON = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  pill: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-35 12 12.5)"/><path d="M9 8l6 8"/></svg>',
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor" stroke="none"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/></svg>',
  finger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11v4M8.5 8.5a5 5 0 0 1 7 0M6 12a6 6 0 0 1 1-4M18 12c0 3-1 5-2 7M9 14c0 2-.5 4-1.5 5.5M15 13c0 2.5-.5 4.5-1.5 6.5M12 4a8 8 0 0 1 8 8"/></svg>'
};

// ---------------- charts (one measure per chart, single axis) ----------------
function lineChart(points, { min, max, unit, label, low }) {
  if (!points.length) return '<p class="muted">No readings yet.</p>';
  const W = 360, H = 200, L = 34, R = 10, T = 22, Bm = 26;
  const t0 = new Date(points[0].t).getTime(), t1 = new Date(points[points.length - 1].t).getTime() || t0 + 1;
  const x = t => L + ((new Date(t).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = v => T + (1 - (v - min) / (max - min)) * (H - T - Bm);
  const ticks = []; for (let v = min; v <= max; v += (max - min) / 4) ticks.push(Math.round(v));
  const path = points.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ');
  const lowLine = low != null ? `<line x1="${L}" x2="${W - R}" y1="${y(low)}" y2="${y(low)}" class="ref"/><text x="${L + 4}" y="${y(low) + 13}" class="ref-t">Get help below ${low}${unit}</text>` : '';
  const flagged = points.filter(p => p.flag);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${v}</text>`).join('')}
    ${lowLine}
    <path d="${path}" class="line"/>
    ${points.map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.flag ? 5.5 : 4}" class="${p.flag ? 'pt flag' : 'pt'}"><title>${esc(fmtDay(p.t))} ${esc(fmtClock(p.t))}: ${p.v}${unit}</title></circle>`).join('')}
    ${flagged.slice(-1).map(p => `<text x="${x(p.t) - 9}" y="${y(p.v) + 4}" text-anchor="end" class="flag-t">${p.v}${unit}</text>`).join('')}
    <text x="${L}" y="${H - 8}" class="ax">${esc(fmtDate(points[0].t, { day: 'numeric', month: 'short' }))}</text>
    <text x="${W - R}" y="${H - 8}" text-anchor="end" class="ax">${esc(fmtDate(points[points.length - 1].t, { day: 'numeric', month: 'short' }))}</text>
  </svg>`;
}

// ---------------- top bar ----------------
const ROLES = [
  ['patient', 'Patient app'], ['doctor', 'Doctor + Scribe'], ['employer', 'Employer'], ['terminal', 'Check-in terminal'], ['studio', 'White-label studio']
];
let ai = { ai: false };
function topbar(role) {
  const b = Brand();
  return `<div class="tb-in">
    <a class="tb-brand" href="/" title="Back to the website"><img data-brand-logo src="${esc(b.logo)}" alt=""><span>CyberHealth</span><em>Demo</em></a>
    <nav class="tb-roles" aria-label="Demo roles">${ROLES.map(([id, label]) => `<a href="#/${id}" class="${role === id ? 'on' : ''}" ${role === id ? 'aria-current="page"' : ''}>${label}</a>`).join('')}<a href="/app/" class="ext">AI co-pilot app ↗</a></nav>
    <div class="tb-tools">
      <button class="chip-btn ${ai.ai ? 'live' : ''}" data-action="code">${ai.ai ? '● Live AI on' : 'Live AI: enter code'}</button>
      <button class="chip-btn" data-action="guide">Demo guide</button>
      <button class="chip-btn" data-action="reset" title="Start the story again">Reset</button>
    </div>
  </div>`;
}

// ---------------- role chooser ----------------
function viewHome() {
  const cards = [
    ['terminal', 'Check-in terminal', 'An employee clocks in with one finger; the same touch measures SpO₂ and pulse into their private app.', ICON.finger],
    ['patient', 'Patient app', 'Vitals from work check-ins, appointments, prescriptions, sick notes, notifications and consult transcripts.', ICON.heart],
    ['doctor', 'Doctor + Scribe', 'Listen to the Scribe recording with a synced transcript, review the AI draft, and sign it to the patient.', ICON.mic],
    ['employer', 'Employer dashboard', 'Attendance and terminal status for HR. Health readings stay private to each employee.', ICON.shield],
    ['studio', 'White-label studio', 'Rebrand the whole product, website, apps and documents, in seconds for your client.', ICON.doc]
  ];
  return `<section class="home">
    <p class="eyebrow">Interactive demo · fictional people</p>
    <h1>See CyberHealth working end to end</h1>
    <p class="lead">One record from the workplace check-in to the consulting room. Pick a view, or follow the 5-minute story in the demo guide.</p>
    <div class="role-grid">${cards.map(([id, t, d, ic]) => `<a class="role-card" href="#/${id}"><span class="ic">${ic}</span><h2>${t}</h2><p>${d}</p><span class="go">Open →</span></a>`).join('')}
      <a class="role-card" href="/app/"><span class="ic">${ICON.doc}</span><h2>AI co-pilot app</h2><p>The full clinician app: pre-consult brief, AI scribe, safety and claim check, pre-auth, AI front desk.</p><span class="go">Open ↗</span></a></div>
  </section>`;
}

// ================= PATIENT =================
function patientShell(tab, inner, title) {
  const b = Brand(); const n = unread();
  const tabs = [['home', 'Home', ICON.home], ['vitals', 'Vitals', ICON.heart], ['visits', 'Visits', ICON.cal], ['records', 'Records', ICON.doc], ['inbox', 'Inbox', ICON.bell]];
  return `<div class="patient-wrap">
    <aside class="side-note">
      <p class="eyebrow">Patient app</p>
      <h2>${esc(D.patient.name)}</h2>
      <p>${esc(D.patient.role)} at ${esc(D.employer.name)} (fictional). Uses the terminal at work and sees GP Dr Thandi Mokoena.</p>
      <ul class="ticks"><li>Vitals from workplace check-ins</li><li>Appointments and reminders</li><li>Prescriptions and repeats</li><li>Doctor's notes and sick notes</li><li>Consult transcripts and summaries</li><li>Notifications</li></ul>
      ${S.get().signed ? '' : '<p class="hint">Story tip: the doctor hasn\'t signed today\'s visit yet. Open <a href="#/doctor">Doctor + Scribe</a>, then come back.</p>'}
    </aside>
    <div class="phone"><div class="phone-in">
      <div class="p-status"><span>${fmtClock(new Date())}</span><span>●●● 5G</span></div>
      <header class="p-head"><img data-brand-logo src="${esc(b.logo)}" alt=""><b>${esc(title || 'CyberHealth')}</b>
        <a href="#/patient/inbox" class="p-bell" aria-label="Notifications, ${n} unread">${ICON.bell}${n ? `<i>${n}</i>` : ''}</a></header>
      <div class="p-body">${inner}</div>
      <nav class="p-tabs" aria-label="App sections">${tabs.map(([id, l, ic]) => `<a href="#/patient/${id}" class="${tab === id ? 'on' : ''}">${ic}<span>${l}</span></a>`).join('')}</nav>
    </div></div>
  </div>`;
}

function pHome() {
  const s = S.get(); const r = readings()[0];
  const next = appointments().find(a => a.status === 'Booked' && new Date(a.when) > new Date());
  const hour = new Date().getHours();
  return `<h1 class="p-h1">Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${esc(D.patient.first)}</h1>
    ${s.signed ? `<div class="p-card ok"><b>Your notes from today are ready</b><p>Dr Mokoena signed your record at ${fmtClock(s.signedAt)}.</p>
        <div class="p-actions"><a class="p-btn" href="#/patient/visit/rec-lerato/summary">Summary</a><a class="p-btn" href="#/patient/visit/rec-lerato/script">Prescription</a><a class="p-btn" href="#/patient/visit/rec-lerato/cert">Sick note</a></div></div>`
      : `<div class="p-card pending"><b>Dr Mokoena is finishing your notes</b><p>From today's visit. You'll get a notification when your prescription, sick note and summary are ready.</p></div>`}
    <a class="p-card link" href="#/patient/vitals"><span class="p-k">Latest check-in reading</span>
      <div class="vit"><div><b>${r.spo2}<small>%</small></b><span>SpO₂</span></div><div><b>${r.pulse}<small> bpm</small></b><span>Pulse rate</span></div></div>
      <span class="p-k">${esc(rel(r.time))} at ${fmtClock(r.time)} · ${esc(r.site)}</span></a>
    ${next ? `<a class="p-card link" href="#/patient/visits"><span class="p-k">Next appointment</span><b>${esc(doc(next.with).name)}</b><p>${esc(fmtDay(next.when))} at ${fmtClock(next.when)} · ${esc(next.reason)}</p></a>` : ''}
    <div class="p-grid">
      <button class="p-tile" data-action="book">${ICON.cal}<span>Book a visit</span></button>
      <a class="p-tile" href="#/patient/records">${ICON.pill}<span>Prescriptions</span></a>
      <a class="p-tile" href="#/patient/records">${ICON.doc}<span>Notes and certificates</span></a>
      <button class="p-tile" data-action="toggle-share">${ICON.shield}<span>${s.shareVitals ? 'Sharing readings with Dr Mokoena' : 'Readings private'}</span></button>
    </div>
    <p class="p-fine">Your employer sees only your check-in and check-out times, never your readings, doctors or appointments.</p>`;
}

function pVitals() {
  const rs = readings().slice().reverse();
  const s = S.get();
  const spo2 = rs.map(r => ({ t: r.time, v: r.spo2, flag: r.spo2 <= 94 }));
  const pulse = rs.map(r => ({ t: r.time, v: r.pulse }));
  return `<h1 class="p-h1">Vitals</h1>
    <p class="p-sub">Measured when you check in at work. Your usual SpO₂ is 97–98 %.</p>
    <div class="p-card"><b>Blood oxygen (SpO₂)</b>${lineChart(spo2, { min: 88, max: 100, unit: '%', label: 'SpO2 over the last month', low: 92 })}</div>
    <div class="p-card"><b>Pulse rate (bpm)</b>${lineChart(pulse, { min: 50, max: 110, unit: '', label: 'Pulse rate over the last month' })}</div>
    <div class="p-card"><div class="row-between"><b>Share with my doctor</b><button class="switch ${s.shareVitals ? 'on' : ''}" role="switch" aria-checked="${s.shareVitals}" data-action="toggle-share"><i></i></button></div>
      <p class="p-fine">${s.shareVitals ? 'Dr Thandi Mokoena can see these readings in your pre-consult brief.' : 'Only you can see these readings.'}</p></div>
    <h2 class="p-h2">All check-ins</h2>
    <table class="p-table"><thead><tr><th>Date</th><th>SpO₂</th><th>Pulse</th><th>Site</th></tr></thead><tbody>
      ${readings().slice(0, 20).map(r => `<tr class="${r.spo2 <= 94 ? 'warnrow' : ''}"><td>${esc(fmtDay(r.time))}<br><small>${fmtClock(r.time)}</small></td><td>${r.spo2} %${r.quality === 'retried' ? '<br><small>retried</small>' : ''}</td><td>${r.pulse}</td><td><small>${esc(r.site)}</small></td></tr>`).join('')}
    </tbody></table>`;
}

function pVisits() {
  const all = appointments(); const now = new Date();
  const up = all.filter(a => new Date(a.when) >= now && a.status !== 'Completed');
  const past = all.filter(a => new Date(a.when) < now || a.status === 'Completed').reverse();
  const item = a => `<div class="p-item ${a.status === 'Cancelled' ? 'cancel' : ''}">
      <div><b>${esc(doc(a.with).name)}</b><span>${esc(doc(a.with).title)} · ${esc(a.place)}</span><span>${esc(fmtDay(a.when))} at ${fmtClock(a.when)} · ${esc(a.reason)}</span></div>
      <div class="p-item-r"><em class="tag ${a.status === 'Booked' ? 'ok' : a.status === 'Cancelled' ? 'bad' : ''}">${esc(a.status)}</em>
      ${a.consult ? `<a class="p-link" href="#/patient/visit/${a.consult}">Open</a>` : ''}
      ${a.status === 'Booked' ? `<button class="p-link" data-action="cancel-appt" data-id="${a.id}">Cancel</button>` : ''}</div></div>`;
  return `<h1 class="p-h1">Visits</h1><button class="p-btn wide" data-action="book">Book a visit</button>
    <h2 class="p-h2">Upcoming</h2>${up.length ? up.map(item).join('') : '<p class="p-fine">Nothing booked.</p>'}
    <h2 class="p-h2">Past</h2>${past.map(item).join('')}`;
}

function transcriptHtml(ls, consent) {
  return `${consent ? `<div class="consent">${ICON.shield}<span>Recording consent given by ${esc(consent.by)} at ${fmtClock(consent.at)}: ${esc(consent.purposes.join('; '))}.</span></div>` : ''}
    <ol class="tx">${ls.map(l => `<li class="${l.who === 'Patient' ? 'pt' : 'dr'}"><span class="t">${fmtTime(l.t0)}</span><b>${l.who === 'Patient' ? 'You' : 'Doctor'}</b><p>${esc(l.text)}</p></li>`).join('')}</ol>`;
}

function pVisit(id, tab) {
  const s = S.get();
  const isToday = id === 'rec-lerato';
  const v = isToday ? { doctor: 'mokoena', start: D.consult.start, reason: D.consult.reason } : D.kneeVisit;
  const tabs = [['summary', 'Summary'], ['note', 'Doctor\'s note'], ['transcript', 'Transcript'], ['script', 'Prescription'], ['cert', isToday ? 'Sick note' : 'Letters']];
  tab = tab || 'summary';
  let body;
  if (isToday && !s.signed) {
    body = `<div class="p-card pending"><b>Waiting for Dr Mokoena to sign</b><p>Your summary, transcript, prescription and sick note appear here as soon as your doctor has reviewed and signed them.</p></div>
      <div class="consent">${ICON.shield}<span>You consented to recording at ${fmtClock(D.consult.consent.at)}. You can withdraw consent in Privacy.</span></div>`;
  } else if (tab === 'summary') {
    const summary = isToday ? D.draft.summary : D.kneeVisit.summary;
    const tr = s.translations[id + ':' + s.lang];
    body = `<div class="p-card"><div class="row-between"><b>In plain language</b>
        <select class="p-select" data-change="lang" aria-label="Summary language">${D.languages.map(l => `<option ${l === s.lang ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <p class="sum">${esc(s.lang === 'English' ? summary : (tr || summary))}</p>
      ${s.lang !== 'English' && !tr ? `<button class="p-btn" data-action="translate" data-id="${id}">Translate with live AI</button><p class="p-fine">Live AI needs a demo access code (top bar).</p>` : ''}
      ${s.lang !== 'English' && tr ? '<p class="p-fine">Translated by AI. Ask your doctor if anything is unclear.</p>' : ''}</div>
      ${isToday ? `<div class="p-card"><b>Follow-up</b><p>${esc(doc('mokoena').name)}, ${esc(fmtDay(followUpWhen()))} at ${fmtClock(followUpWhen())}</p></div>` : ''}`;
  } else if (tab === 'note') {
    const n = isToday ? note() : null;
    body = isToday ? `<div class="p-card soap">${['S', 'O', 'A', 'P'].map(k => `<b>${{ S: 'What you told the doctor', O: 'Examination', A: 'Diagnosis', P: 'Plan' }[k]}</b><p>${esc(n[k])}</p>`).join('')}
        <p class="codes">${D.draft.codes.map(c => `<span>${c.code}</span> ${esc(c.label)}`).join(' · ')}</p></div><a class="p-btn" href="#/doc/note/rec-lerato" target="_blank">Open as document</a>`
      : `<div class="p-card"><p>${esc(D.kneeVisit.note)}</p><p class="codes"><span>M22.2</span> Patellofemoral disorders</p></div>`;
  } else if (tab === 'transcript') {
    body = `<div class="p-card">${transcriptHtml(isToday ? lines : kneeLines, isToday ? D.consult.consent : null)}</div>`;
  } else if (tab === 'script') {
    const items = isToday ? D.draft.script : D.kneeVisit.script;
    body = `${items.map(it => `<div class="p-card"><b>${esc(it.drug)}</b><p>${esc(it.directions)}</p><span class="p-k">${esc(it.qty)}${it.repeats ? ' · ' + it.repeats + ' repeat' : ''}</span></div>`).join('')}
      ${isToday ? `<div class="p-actions"><a class="p-btn" href="#/doc/script/rec-lerato" target="_blank">View script</a>
        ${s.scriptSentTo ? `<span class="tag ok">Sent to ${esc(s.scriptSentTo)}</span>` : '<button class="p-btn" data-action="send-script">Send to Rosebank Pharmacy</button>'}</div>` : ''}`;
  } else {
    body = isToday ? `<div class="p-card"><b>Medical certificate</b><p>Unfit for work from ${esc(fmtDate(certFrom()))} to ${esc(fmtDate(certTo()))} (${D.draft.certificate.days} days).</p>
        <div class="p-actions"><a class="p-btn" href="#/doc/cert/rec-lerato" target="_blank">Open certificate</a>
        <button class="p-btn ${s.certShared ? 'ghost' : ''}" data-action="share-cert">${s.certShared ? 'Shared with HR ✓' : 'Share with HR'}</button></div>
        <p class="p-fine">HR receives the certificate only; your diagnosis stays private unless you choose otherwise.</p></div>`
      : `<div class="p-card"><b>Referral to physiotherapy</b><p>Rosebank Physio, 6 weeks of patellofemoral rehabilitation.</p></div>`;
  }
  return `<a class="p-back" href="#/patient/visits">‹ Visits</a>
    <h1 class="p-h1">${esc(doc(v.doctor).name)}</h1><p class="p-sub">${esc(fmtDate(v.start))} · ${esc(v.reason)}</p>
    <div class="p-seg" role="tablist">${tabs.map(([k, l]) => `<a role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" href="#/patient/visit/${id}/${k}">${l}</a>`).join('')}</div>
    ${body}`;
}

function pRecords() {
  const s = S.get();
  const scripts = [...(s.signed ? [{ v: 'rec-lerato', when: s.signedAt, by: 'mokoena', items: D.draft.script }] : []), { v: 'rec-knee', when: D.kneeVisit.start, by: 'patel', items: D.kneeVisit.script }];
  return `<h1 class="p-h1">Records</h1>
    <h2 class="p-h2">Prescriptions</h2>
    ${scripts.map(x => `<a class="p-item link" href="#/patient/visit/${x.v}/script"><div><b>${esc(x.items.map(i => i.drug.split(' ')[0]).join(', '))}</b><span>${esc(doc(x.by).name)} · ${esc(fmtDate(x.when))}</span></div><em class="tag ${x.v === 'rec-lerato' ? 'ok' : ''}">${x.v === 'rec-lerato' ? 'Active' : 'Completed'}</em></a>`).join('')}
    <h2 class="p-h2">Doctor's notes and certificates</h2>
    ${s.signed ? `<a class="p-item link" href="#/patient/visit/rec-lerato/cert"><div><b>Medical certificate</b><span>${esc(fmtDate(certFrom()))} to ${esc(fmtDate(certTo()))}</span></div><em class="tag ok">New</em></a>
      <a class="p-item link" href="#/patient/visit/rec-lerato/note"><div><b>Doctor's note</b><span>Dr Thandi Mokoena · today</span></div></a>` : '<p class="p-fine">Today\'s note and sick note appear once Dr Mokoena signs.</p>'}
    <a class="p-item link" href="#/patient/visit/rec-knee/note"><div><b>Doctor's note: right knee</b><span>Dr Ayesha Patel · ${esc(fmtDate(D.kneeVisit.start))}</span></div></a>
    <h2 class="p-h2">Letters</h2>
    <a class="p-item link" href="#/patient/visit/rec-knee/cert"><div><b>Referral to physiotherapy</b><span>Dr Ayesha Patel · ${esc(fmtDate(D.kneeVisit.start))}</span></div></a>
    <h2 class="p-h2">Consult transcripts</h2>
    ${s.signed ? `<a class="p-item link" href="#/patient/visit/rec-lerato/transcript"><div><b>GP consult transcript</b><span>Today · ${lines.length} turns · consent recorded</span></div></a>` : ''}
    <a class="p-item link" href="#/patient/visit/rec-knee/transcript"><div><b>Orthopaedic consult transcript</b><span>${esc(fmtDate(D.kneeVisit.start))}</span></div></a>`;
}

function pInbox() {
  const read = S.get().readNotifs;
  const list = notifications();
  return `<div class="row-between"><h1 class="p-h1">Inbox</h1><button class="p-link" data-action="read-all">Mark all read</button></div>
    ${list.map(n => `<a class="p-notif ${read.includes(n.id) ? '' : 'new'}" href="${n.link || '#/patient/inbox'}" data-read="${n.id}">
      <span class="k ${n.kind}"></span><div><b>${esc(n.title)}</b><p>${esc(n.body)}</p><small>${esc(rel(n.at))} · ${fmtClock(n.at)}</small></div></a>`).join('')}`;
}

// ---------------- printable documents ----------------
function viewDoc(kind) {
  const b = Brand(); const s = S.get(); const dr = doc('mokoena');
  if (!s.signed) return `<div class="docpage"><p>This document is issued once Dr Mokoena signs the record. <a href="#/doctor">Open the doctor workspace</a>.</p></div>`;
  const head = `<header class="dh"><div class="dh-brand"><img data-brand-logo src="${esc(b.logo)}" alt=""><div><b>CyberHealth</b><small>${esc(b.domain || '')}</small></div></div>
    <div class="dh-pr"><b>${esc(dr.practice.name)}</b><small>${esc(dr.practice.address)}<br>Practice no. ${esc(dr.practice.practiceNo)} · Tel ${esc(dr.practice.phone)}</small></div></header>`;
  const pt = `<table class="dkv"><tr><th>Patient</th><td>${esc(D.patient.name)}</td><th>ID</th><td>${esc(D.patient.idNo)}</td></tr>
    <tr><th>Medical aid</th><td>${esc(D.patient.medicalAid)}</td><th>Member no.</th><td>${esc(D.patient.memberNo)}</td></tr></table>`;
  const sign = `<div class="dsign"><div><span class="esig">${esc(dr.name)}</span><small>Electronically signed ${esc(fmtDate(s.signedAt))} ${fmtClock(s.signedAt)} · ${esc(dr.hpcsa)}</small></div>
    <div class="verify">Verify: ${esc((b.domain || 'cyberhealth.business'))}/verify · ref CH-${String(Math.abs(hash(s.signedAt))).slice(0, 8)}</div></div>`;
  let title, body;
  if (kind === 'cert') {
    title = 'Medical certificate';
    body = `<p>I, ${esc(dr.name)}, examined the patient named above on <b>${esc(fmtDate(D.consult.start))}</b>. This certificate is based on my own observation.</p>
      <p>In my opinion the patient is <b>unfit for duty from ${esc(fmtDate(certFrom()))} to ${esc(fmtDate(certTo()))}</b> (${D.draft.certificate.days} days), inclusive.</p>
      <p>Nature of illness: ${esc(D.draft.certificate.reason)}.</p>`;
  } else if (kind === 'script') {
    title = 'Prescription';
    body = `<table class="dtab"><thead><tr><th>Medicine</th><th>Directions</th><th>Quantity</th><th>Repeats</th></tr></thead><tbody>
      ${D.draft.script.map(i => `<tr><td><b>${esc(i.drug)}</b></td><td>${esc(i.directions)}</td><td>${esc(i.qty)}</td><td>${i.repeats}</td></tr>`).join('')}</tbody></table>
      <p class="small">Allergies: ${esc(D.patient.allergies.join(', '))}. Diagnosis codes: ${D.draft.codes.map(c => c.code).join(', ')}.</p>`;
  } else {
    title = 'Clinical note';
    const n = note();
    body = ['S', 'O', 'A', 'P'].map(k => `<h3>${{ S: 'Subjective', O: 'Objective', A: 'Assessment', P: 'Plan' }[k]}</h3><p>${esc(n[k])}</p>`).join('') +
      `<p class="small">ICD-10: ${D.draft.codes.map(c => c.code + ' ' + esc(c.label)).join('; ')}</p>`;
  }
  return `<div class="docbar"><a href="#/patient/records">‹ Back to the app</a><button class="btn" data-action="print">Print or save as PDF</button></div>
    <article class="docpage">${head}<h1>${title}</h1><p class="small">Date: ${esc(fmtDate(s.signedAt))}</p>${pt}${body}${sign}
    <footer class="df">Issued through CyberHealth · Technology powered by Cyber Development (Pty) Ltd · Demo document, fictional patient</footer></article>`;
}
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

// ================= DOCTOR =================
let player = null; let playerFor = null;

function recById(id) {
  if (id === 'rec-lerato') return { id, patientName: D.patient.name, age: D.patient.age, reason: D.consult.reason, start: D.consult.start, lines, status: S.get().signed ? 'Signed' : 'Ready to review', main: true };
  const r = D.otherRecordings.find(x => x.id === id);
  return r ? { ...r, lines: otherLines[r.id], status: S.get().otherSigned.includes(r.id) ? 'Signed' : r.status } : null;
}

function waveBars(id, n = 120) {
  let s = Math.abs(hash(id)) + 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i / 3.1)) * (0.45 + 0.55 * r()));
}

function vDoctor(recId) {
  const s = S.get(); recId = recId || 'rec-lerato';
  const rec = recById(recId) || recById('rec-lerato');
  const recs = ['rec-lerato', ...D.otherRecordings.map(r => r.id)].map(recById);
  const dur = rec.lines.length ? rec.lines[rec.lines.length - 1].t1 + 1 : 0;
  const bars = waveBars(rec.id);
  const isMain = rec.main; const drafting = rec.status === 'Drafting';
  const n = note();
  const vit = readings().slice(0, 8).reverse();
  return `<div class="dr">
    <aside class="dr-side">
      <div class="dr-me"><b>${esc(doc('mokoena').name)}</b><span>${esc(doc('mokoena').practice.name)}</span></div>
      <div class="dev ${s.scribeLocked ? 'locked' : ''}"><div class="dev-ic"><span></span></div><div><b>CyberHealth Scribe</b><span>CH-S-000231 · ${s.scribeLocked ? 'Locked remotely' : 'Paired to you'}</span>
        <span>Battery 78 % · 41 h free · synced ${fmtClock(D.at(0, 10, 42))}</span></div>
        <button class="link-btn" data-action="lock-scribe">${s.scribeLocked ? 'Unlock' : 'Lock device'}</button></div>
      <h3>Today's recordings</h3>
      <ul class="recs">${recs.map(r => `<li><a href="#/doctor/${r.id}" class="${r.id === rec.id ? 'on' : ''}"><b>${esc(r.patientName)}</b><span>${fmtClock(r.start)} · ${esc(r.reason)}</span>
        <em class="tag ${r.status === 'Signed' ? 'ok' : r.status === 'Drafting' ? '' : 'warn'}">${esc(r.status)}</em></a></li>`).join('')}</ul>
      <a class="side-link" href="/app/">Open the full AI co-pilot app ↗</a>
    </aside>
    <section class="dr-main">
      <header class="dr-head"><div><h1>${esc(rec.patientName)}, ${rec.age}</h1><p>${esc(rec.reason)} · ${fmtClock(rec.start)} · ${fmtTime(dur)} recorded on the Scribe</p></div>
        ${isMain ? `<div class="consent sm">${ICON.shield}<span>Consent ${fmtClock(D.consult.consent.at)}: recording and AI drafting</span></div>` : ''}</header>
      <div class="audio" data-rec="${rec.id}">
        <button class="play" data-action="play" aria-label="Play recording">${ICON.play}</button>
        <div class="wave" data-action="seek" data-dur="${dur}" role="slider" aria-label="Recording position" aria-valuemin="0" aria-valuemax="${Math.round(dur)}" aria-valuenow="0" tabindex="0">
          ${bars.map(h => `<i style="height:${(h * 100).toFixed(0)}%"></i>`).join('')}<span class="head"></span></div>
        <span class="time"><span data-pos>0:00</span> / ${fmtTime(dur)}</span>
        <select data-change="rate" aria-label="Playback speed"><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select>
      </div>
      <p class="audio-note" data-audio-note>Checking for the recording…</p>
      <div class="dr-cols">
        <div class="tx-wrap"><div class="row-between"><h2>Transcript</h2><input class="search" type="search" placeholder="Search transcript" data-input="tx-search" aria-label="Search transcript"></div>
          <ol class="tx live">${rec.lines.map((l, i) => `<li data-i="${i}" data-t="${l.t0}" class="${l.who === 'Patient' ? 'pt' : 'dr'}"><button class="t" data-action="seek-line" data-t="${l.t0}">${fmtTime(l.t0)}</button><b>${l.who}</b><p>${esc(l.text)}</p></li>`).join('')}</ol></div>
        <div class="draft">
          ${drafting ? `<div class="card"><b>Drafting…</b><p class="muted">The Scribe uploaded this recording 2 minutes ago. The draft appears here in under a minute.</p><div class="skel"></div><div class="skel"></div><div class="skel short"></div></div>` :
      isMain ? `
          <div class="row-between"><h2>AI draft ${s.aiNote ? '<em class="tag ok">Live AI</em>' : ''}</h2><button class="btn ghost sm" data-action="regen">Regenerate with live AI</button></div>
          ${s.signed ? `<div class="banner ok">Signed ${fmtClock(s.signedAt)} and sent to ${esc(D.patient.first)}'s app: summary, transcript, prescription, sick note and follow-up. <a href="#/patient/home">View as patient →</a></div>` : ''}
          <div class="safety">${D.draft.safety.map(a => `<div class="al ${a.level}"><b>${esc(a.title)}</b><span>${esc(a.detail)}</span></div>`).join('')}</div>
          <div class="soap-ed">${['S', 'O', 'A', 'P'].map(k => `<label><span>${{ S: 'Subjective', O: 'Objective', A: 'Assessment', P: 'Plan' }[k]}</span><textarea data-note="${k}" rows="${k === 'S' || k === 'P' ? 5 : 3}" ${s.signed ? 'readonly' : ''}>${esc(n[k])}</textarea></label>`).join('')}</div>
          <div class="kv"><b>ICD-10</b><div>${D.draft.codes.map(c => `<span class="code">${c.code}</span> ${esc(c.label)} <small>${c.role} · ${(c.confidence * 100).toFixed(0)} %</small>`).join('<br>')}</div></div>
          <div class="kv"><b>Prescription</b><div>${D.draft.script.map(i => `${esc(i.drug)}: ${esc(i.directions)} (${esc(i.qty)}${i.repeats ? ', ' + i.repeats + ' repeat' : ''})`).join('<br>')}</div></div>
          <div class="kv"><b>Sick note</b><div>Unfit for duty ${esc(fmtDate(certFrom()))} to ${esc(fmtDate(certTo()))} (${D.draft.certificate.days} days)</div></div>
          <div class="kv"><b>Follow-up</b><div>${esc(fmtDay(followUpWhen()))} at ${fmtClock(followUpWhen())}, booked into your queue on signing</div></div>
          <details class="kv"><summary><b>Patient summary</b> (sent in ${esc(D.patient.language)})</summary><p>${esc(D.draft.summary)}</p></details>
          ${s.shareVitals ? `<div class="kv"><b>Shared workplace readings</b><div>${lineChart(vit.map(r => ({ t: r.time, v: r.spo2, flag: r.spo2 <= 94 })), { min: 88, max: 100, unit: '%', label: 'Patient SpO2 from workplace check-ins' })}</div></div>` : ''}
          <div class="sign-row">${s.signed ? '<button class="btn" disabled>Signed</button>' : '<button class="btn" data-action="sign">Sign and send to patient</button>'}
            <span class="muted">Nothing reaches the patient, pharmacy or medical aid until you sign.</span></div>`
        : `<div class="row-between"><h2>AI draft</h2></div>
          <div class="soap-ed"><label><span>Clinical note</span><textarea rows="8">${esc(rec.note)}</textarea></label></div>
          <div class="sign-row">${rec.status === 'Signed' ? '<button class="btn" disabled>Signed</button>' : `<button class="btn" data-action="sign-other" data-id="${rec.id}">Sign</button>`}</div>`}
        </div>
      </div>
    </section>
  </div>`;
}

function bindDoctor(recId) {
  const rec = recById(recId || 'rec-lerato') || recById('rec-lerato');
  if (playerFor !== rec.id) { if (player) player.destroy(); player = null; }
  const box = $('.audio'); if (!box) return;
  const bars = [...box.querySelectorAll('.wave i')];
  const head = box.querySelector('.head');
  const items = [...document.querySelectorAll('.tx.live li')];
  let lastLine = -1;
  const onTick = (pos, li) => {
    const dur = player.duration; const f = dur ? pos / dur : 0;
    head.style.left = (f * 100) + '%';
    const k = Math.floor(f * bars.length);
    bars.forEach((b, i) => b.classList.toggle('done', i < k));
    const posEl = document.querySelector('[data-pos]'); if (posEl) posEl.textContent = fmtTime(pos);
    box.querySelector('.wave').setAttribute('aria-valuenow', String(Math.round(pos)));
    if (li !== lastLine) {
      items.forEach((el, i) => el.classList.toggle('now', i === li));
      const el = items[li];
      if (el && player.playing) { const wrap = el.closest('.tx'); wrap.scrollTo({ top: el.offsetTop - wrap.offsetTop - 60, behavior: 'smooth' }); }
      lastLine = li;
    }
  };
  const onState = p => {
    const btn = box.querySelector('.play'); btn.innerHTML = p.playing ? ICON.pause : ICON.play; btn.setAttribute('aria-label', p.playing ? 'Pause' : 'Play recording');
    const note = document.querySelector('[data-audio-note]');
    if (note) note.textContent = p.mode === 'file' ? 'Scribe recording · encrypted, stored in South Africa'
      : p.mode === 'voice' ? 'Demo audio: your browser voices this fictional consult. Live deployments play the Scribe\'s own recording.'
      : p.mode === 'silent' ? 'Demo playback without sound (this browser has no voices). Live deployments play the Scribe\'s own recording.' : 'Checking for the recording…';
  };
  if (!player) { player = new ScribePlayer(rec.id, rec.lines, { onTick, onState }); playerFor = rec.id; }
  else { player.onTick = onTick; player.onState = onState; }
  onState(player); onTick(player.pos, player.lineAt(player.pos));
  const rate = box.querySelector('select'); rate.value = String(player.rate);
}

// ================= EMPLOYER =================
const STAFF = ['Sipho Mahlangu', 'Annelie de Beer', 'Kagiso Molefe', 'Fatima Ebrahim', 'Thabo Nkosi', 'Megan Fourie', 'Ayanda Zulu', 'Ruan Steyn', 'Precious Mthembu', 'Johan Pretorius', 'Naledi Sithole', 'Zanele Mokoena'];
function vEmployer() {
  const s = S.get();
  const extra = s.extraCheckins.filter(c => c.type === 'Check in' && new Date(c.time) >= D.today);
  const rows = STAFF.map((n, i) => ({ name: n, in: D.at(0, 7, 12 + i * 4), site: D.employer.sites[i % 3].name }));
  if (extra.length) rows.unshift({ name: D.patient.name, in: new Date(extra[0].time), site: extra[0].site });
  const checked = D.employer.sites.reduce((a, x) => a + x.checkinsToday, 0) + extra.length;
  const uptake = Math.round(D.employer.optedIn / D.employer.employees * 100);
  return `<div class="emp">
    <header class="emp-head"><div><p class="eyebrow">Employer workspace · fictional company</p><h1>${esc(D.employer.name)}</h1></div>
      <button class="btn ghost" data-action="export-csv">Export today's attendance (CSV)</button></header>
    <div class="kpis">
      <div class="kpi"><b>${checked}</b><span>Checked in today of ${D.employer.employees}</span></div>
      <div class="kpi"><b>${D.employer.sites.filter(x => x.status === 'online').length} / ${D.employer.sites.length}</b><span>Terminals online</span></div>
      <div class="kpi"><b>${uptake} %</b><span>Joined optional health screening</span></div>
      <div class="kpi"><b>${s.certShared ? 1 : 0}</b><span>Sick notes shared by staff today</span></div>
    </div>
    <div class="emp-cols">
      <div class="card"><h2>Terminals</h2><table class="tbl"><thead><tr><th>Terminal</th><th>Site</th><th>Status</th><th>Check-ins today</th></tr></thead><tbody>
        ${D.employer.sites.map(x => `<tr><td>${x.id}</td><td>${esc(x.name)}${x.issue ? `<br><small class="muted">${esc(x.issue)}</small>` : ''}</td><td><em class="tag ${x.status === 'online' ? 'ok' : 'bad'}">${x.status === 'online' ? 'Online' : 'Offline'}</em></td><td>${x.checkinsToday + (x.id === 'T-01' ? extra.length : 0)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card privacy"><h2>${ICON.shield} What you can't see</h2><p>SpO₂ and pulse readings, diagnoses, doctors, appointments and prescriptions stay in each employee's private app. Health screening is optional and never affects attendance or access.</p>
        ${s.certShared ? `<div class="banner ok">${esc(D.patient.name)} shared a medical certificate: unfit for duty ${esc(fmtDate(certFrom(), { day: 'numeric', month: 'short' }))} to ${esc(fmtDate(certTo(), { day: 'numeric', month: 'short' }))}. Diagnosis not shared.</div>` : `<p class="muted">Certificates appear here only when an employee chooses to share one.</p>`}</div>
    </div>
    <div class="card"><h2>Attendance today</h2><table class="tbl"><thead><tr><th>Employee</th><th>Checked in</th><th>Site</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${fmtClock(r.in)}</td><td>${esc(r.site)}</td></tr>`).join('')}
      ${extra.length ? '' : `<tr><td>${esc(D.patient.name)}</td><td colspan="2" class="muted">${s.certShared ? 'Off sick (certificate shared)' : 'Not checked in'}</td></tr>`}</tbody></table></div>
  </div>`;
}

// ================= TERMINAL =================
let term = { phase: 'idle', who: 'lerato', kind: 'Check in', poor: false, low: false };
function vTerminal() {
  const p = term.phase;
  const name = term.who === 'lerato' ? D.patient.name : 'Thabo Nkosi';
  let screen;
  if (p === 'idle') screen = `<div class="k-time">${fmtClock(new Date())}</div><div class="k-site">Head office · Midrand · T-01</div>
      <div class="k-btns"><button class="k-btn ${term.kind === 'Check in' ? 'on' : ''}" data-action="k-kind" data-v="Check in">Check in</button><button class="k-btn ${term.kind === 'Check out' ? 'on' : ''}" data-action="k-kind" data-v="Check out">Check out</button></div>
      <p class="k-msg">Place your finger on the sensor</p>`;
  else if (p === 'identify') screen = `<div class="k-spin"></div><p class="k-msg">Reading fingerprint…</p>`;
  else if (p === 'recorded') screen = `<span class="k-ok">✓ ${esc(term.kind)} recorded</span><p class="k-name">${esc(name)}</p><p class="k-msg">${fmtClock(new Date())}</p>`;
  else if (p === 'measure') screen = `<span class="k-ok">✓ ${esc(term.kind)} recorded</span><p class="k-msg">Keep your finger still while we capture your readings.</p><span class="k-bar"><i></i></span><p class="k-sub">Measuring SpO₂ and pulse rate</p>`;
  else if (p === 'retry') screen = `<span class="k-warn">Poor signal</span><p class="k-msg">Warm your hands and place your finger flat. Nothing is ever guessed.</p><button class="k-btn on" data-action="k-place">Try again</button>`;
  else if (p === 'done') screen = `<span class="k-ok">✓ Readings saved</span><div class="k-vals"><div><b>${term.result.spo2} %</b><span>SpO₂</span></div><div><b>${term.result.pulse}</b><span>Pulse bpm</span></div></div>
      <p class="k-sub">Sent privately to your CyberHealth app.${term.result.spo2 < 95 ? ' This is lower than your usual range; see the advice in your app.' : ''}</p>`;
  return `<div class="term">
    <aside class="side-note"><p class="eyebrow">Check-in terminal simulator</p><h2>One touch: attendance, then optional SpO₂ and pulse</h2>
      <p>Attendance is saved first, whatever happens next. If the employee has joined health screening, the same finger placement measures SpO₂ and pulse rate and sends them only to their app.</p>
      <label class="fld">Employee<select data-change="k-who"><option value="lerato" ${term.who === 'lerato' ? 'selected' : ''}>Lerato Dlamini (screening on)</option><option value="thabo" ${term.who === 'thabo' ? 'selected' : ''}>Thabo Nkosi (screening off)</option></select></label>
      <label class="chk"><input type="checkbox" data-change="k-poor" ${term.poor ? 'checked' : ''}> Simulate a poor signal first</label>
      <label class="chk"><input type="checkbox" data-change="k-low" ${term.low ? 'checked' : ''}> Simulate a low reading (93 %)</label>
      <p class="hint">After a reading, open the <a href="#/patient/vitals">patient app</a> or the <a href="#/employer">employer dashboard</a>.</p></aside>
    <div class="kiosk"><div class="k-screen"><span class="k-brand"><img data-brand-logo src="${esc(Brand().logo)}" alt=""> CYBERHEALTH · ${esc(term.kind.toUpperCase())}</span>${screen}</div>
      <button class="k-sensor ${p === 'identify' || p === 'measure' ? 'busy' : ''}" data-action="k-place" aria-label="Place finger on the sensor" ${p === 'idle' || p === 'done' || p === 'recorded' ? '' : 'disabled'}>${ICON.finger}</button>
      <span class="k-cap">Tap the sensor to place a finger</span></div>
  </div>`;
}
let termTimers = [];
function termRun() {
  termTimers.forEach(clearTimeout); termTimers = [];
  const next = (ph, ms, fn) => termTimers.push(setTimeout(() => { term.phase = ph; if (fn) fn(); if (route().role === 'terminal') render(); }, ms));
  const first = term.phase !== 'retry';
  term.phase = 'identify'; render();
  const who = term.who; const kind = term.kind;
  next('recorded', 1100, () => {
    const t = new Date().toISOString();
    if (who === 'lerato') S.set(s => ({ extraCheckins: [...s.extraCheckins, { id: 'k' + Date.now(), time: t, site: 'Head office · Midrand', terminal: 'T-01', type: kind, spo2: null, pulse: null }] }), true);
  });
  if (who !== 'lerato' || kind === 'Check out') { next('idle', 3600); return; }
  next('measure', 2300);
  if (term.poor && first) { next('retry', 5200); return; }
  next('done', 7600, () => {
    const spo2 = term.low ? 93 : 97 + Math.round(Math.random()), pulse = term.low ? 94 : 68 + Math.round(Math.random() * 8);
    term.result = { spo2, pulse };
    const t = new Date().toISOString();
    S.set(s => ({ extraCheckins: [...s.extraCheckins, { id: 'r' + Date.now(), time: t, site: 'Head office · Midrand', terminal: 'T-01', type: 'Reading', spo2, pulse, quality: term.poor ? 'retried' : 'good' }] }), true);
    S.notify(spo2 < 95 ? { kind: 'vitals', title: 'Your SpO₂ was lower than usual', body: `This check-in read ${spo2} % (your usual range is 97–98 %). If you feel short of breath or unwell, see a doctor or go to casualty if it's severe.`, link: '#/patient/vitals' }
      : { kind: 'vitals', title: 'New check-in reading', body: `SpO₂ ${spo2} % and pulse ${pulse} bpm at Head office · Midrand.`, link: '#/patient/vitals' });
  });
  next('idle', 14000);
}

// ================= WHITE-LABEL STUDIO =================
let draftBrand = null;
function vStudio() {
  const b = Brand();
  const d = draftBrand || { name: b.custom ? b.name : 'Ubuntu Health', domain: b.custom ? b.domain : 'ubuntuhealth.co.za', tagline: b.custom ? b.tagline : 'Care that knows you', color: b.custom ? b.sourceColor : '#6B3FA0', logo: b.custom ? b.logo : null };
  draftBrand = d;
  const pv = window.CHBrand.preview(d);
  const c = pv.colors;
  const cr = window.CHBrand.contrast(c.accent, '#FFFFFF').toFixed(1);
  const included = [
    ['Branded website', 'Landing page, pilot sign-up and legal pages on your domain'],
    ['Patient and employee app', 'iPhone, Android and web: vitals, visits, prescriptions, certificates, transcripts, notifications'],
    ['Clinician AI co-pilot', 'Scribe recordings, AI notes, ICD-10, scripts, safety and claim check, pre-auth, front desk'],
    ['Scribe recorders', 'Your logo on the device and packaging; paired and managed from the app'],
    ['Check-in terminals', 'Attendance with optional SpO₂ and pulse; employer workspace'],
    ['Security and compliance', 'POPIA design, SA hosting, penetration tested by Cyber Development before every release'],
    ['Set-up and support', 'Brand set-up, practice onboarding, training and helpdesk']
  ];
  return `<div class="studio">
    <header><p class="eyebrow">White-label studio</p><h1>Your brand on the whole product, in seconds</h1>
      <p class="lead">Currently showing: <b>${esc(b.name)}</b>. Pick a sample client or create your own, then click through the website, apps and documents.</p></header>
    <div class="st-cols">
      <div class="card">
        <h2>Sample brands</h2>
        <div class="presets" data-brand-keep>${Object.values(window.CHBrand.presets).map(p => `<button class="preset ${b.id === p.id && !b.custom ? 'on' : ''}" data-action="preset" data-id="${p.id}"><img src="${esc(p.logo)}" alt=""><span><b>${esc(p.name)}</b><small>${esc(p.domain)}</small></span></button>`).join('')}</div>
        <h2>Create your own</h2>
        <form class="bform" data-form="brand">
          <label class="fld">Product name<input name="name" value="${esc(d.name)}" maxlength="40" required data-input="brand"></label>
          <label class="fld">Domain<input name="domain" value="${esc(d.domain)}" maxlength="80" data-input="brand"></label>
          <label class="fld">Tagline<input name="tagline" value="${esc(d.tagline)}" maxlength="90" data-input="brand"></label>
          <div class="fld-row"><label class="fld">Brand colour<input type="color" name="color" value="${esc(d.color)}" data-input="brand"></label>
            <label class="fld">Logo (square PNG/SVG, under 300 KB)<input type="file" name="logo" accept="image/png,image/svg+xml,image/jpeg,image/webp" data-change="logo"></label></div>
          <p class="muted">White text on your button colour: contrast ${cr}:1 ${cr >= 4.5 ? '✓ passes WCAG AA' : ''}. Colours are adjusted automatically to stay readable.</p>
          <div class="row-gap"><button class="btn" type="submit">Apply to the whole demo</button><button class="btn ghost" type="button" data-action="export-brand">Download brand config</button></div>
        </form>
      </div>
      <div class="card preview" style="--pv1:${c.primary};--pv2:${c.accent};--pvs:${c.soft};--pvn:${c.navy}">
        <h2>Live preview</h2>
        <div class="pv-site"><div class="pv-nav"><span class="pv-logo">${d.logo ? `<img src="${esc(d.logo)}" alt="">` : `<i>${esc((d.name || '?')[0])}</i>`}<b>${esc(d.name)}</b></span><span class="pv-cta">Get the app</span></div>
          <div class="pv-hero"><h3>${esc(d.tagline || 'One health record, from check-in to consult')}</h3><span class="pv-btn">Try the web demo</span></div></div>
        <div class="pv-row"><div class="pv-phone"><div class="pv-ph">${esc(d.name)}</div><div class="pv-card">Your notes from today are ready</div><div class="pv-card soft">SpO₂ 98 % · Pulse 72</div></div>
          <div class="pv-scribe"><span></span><small>${esc((d.name || '').toUpperCase())} SCRIBE</small></div></div>
        <p class="muted">${esc(d.domain || '')}</p>
      </div>
    </div>
    <div class="card"><h2>What a turnkey licence includes</h2><div class="incl">${included.map(([t, x]) => `<div><b>${t}</b><span>${x}</span></div>`).join('')}</div>
      <p class="muted">Hosted for you in a South African cloud region, or deployed as a dedicated instance. Technology powered by Cyber Development (Pty) Ltd.</p>
      <a class="btn" href="/#contact">Talk to us about a white-label licence</a></div>
  </div>`;
}

// ================= ROUTER + RENDER =================
function route() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  return { role: parts[0] || '', a: parts[1], b: parts[2], c: parts[3] };
}

function render() {
  const r = route();
  document.body.dataset.role = r.role || 'home';
  $('#topbar').innerHTML = topbar(r.role);
  let html;
  switch (r.role) {
    case 'patient': {
      const tab = r.a || 'home';
      const map = { home: [pHome, 'CyberHealth'], vitals: [pVitals, 'Vitals'], visits: [pVisits, 'Visits'], records: [pRecords, 'Records'], inbox: [pInbox, 'Inbox'] };
      if (tab === 'visit') html = patientShell('visits', pVisit(r.b, r.c), 'Visit');
      else { const [fn, t] = map[tab] || map.home; html = patientShell(tab, fn(), t); }
      break;
    }
    case 'doc': html = viewDoc(r.a); break;
    case 'doctor': html = vDoctor(r.a); break;
    case 'employer': html = vEmployer(); break;
    case 'terminal': html = vTerminal(); break;
    case 'studio': html = vStudio(); break;
    default: html = viewHome();
  }
  const main = $('#main');
  const keepScroll = main.dataset.view === location.hash ? (main.querySelector('.p-body') || {}).scrollTop : 0;
  main.innerHTML = html; main.dataset.view = location.hash;
  if (keepScroll) { const pb = main.querySelector('.p-body'); if (pb) pb.scrollTop = keepScroll; }
  if (r.role === 'doctor') bindDoctor(r.a);
  else if (player) { player.destroy(); player = null; playerFor = null; }
}

// ---------------- actions ----------------
async function codeDialog() {
  const st = await aiStatus(true);
  modal(`<h2>Live AI</h2>
    <p>Visitors see ready-made demo content. Enter the demo access code you were given to switch on live AI for regenerating notes, translating summaries and the AI co-pilot app.</p>
    ${st.keyConfigured === false ? '<p class="banner warn">Live AI isn\'t configured on this server yet (no API key).</p>' : ''}
    <form data-form="code"><label class="fld">Demo access code<input name="code" value="${esc(getCode())}" autocomplete="off" spellcheck="false"></label>
    <div class="row-gap"><button class="btn" type="submit">Save</button>${getCode() ? '<button class="btn ghost" type="button" data-action="clear-code">Remove code</button>' : ''}<button class="btn ghost" type="button" data-action="close-modal">Close</button></div></form>
    <p class="muted">Status: ${st.ai ? 'live AI is on' : st.codeValid === false && getCode() ? 'code not recognised' : 'off'}.</p>`);
}

function guide() {
  const steps = [
    ['#/terminal', 'Check in at work', 'Tap the sensor: attendance first, then SpO₂ and pulse go privately to Lerato\'s app.'],
    ['#/patient/vitals', 'Lerato\'s app', 'Her readings, the low reading she shared two days ago, and her appointment today.'],
    ['#/doctor', 'Doctor + Scribe', 'Play the Scribe recording, follow the transcript, check the safety alerts, then Sign and send.'],
    ['#/patient/home', 'Back to the patient', 'Notifications, summary, transcript, prescription to a pharmacy, sick note to HR.'],
    ['#/employer', 'Employer', 'Attendance and terminals only. The certificate arrives without the diagnosis.'],
    ['#/studio', 'Make it theirs', 'Rebrand everything for a client in seconds.']
  ];
  modal(`<h2>5-minute demo story</h2><ol class="guide">${steps.map(([h, t, d], i) => `<li><a href="${h}" data-action="close-modal-nav"><b>${i + 1}. ${t}</b><span>${d}</span></a></li>`).join('')}</ol>
    <div class="row-gap"><button class="btn ghost" data-action="close-modal">Close</button></div>`);
}

function bookDialog() {
  const slots = [1, 2, 3].map(d => D.at(d, 10, 0)).concat([D.at(2, 15, 30)]);
  modal(`<h2>Book a visit</h2><form data-form="book">
    <label class="fld">Clinician<select name="with">${Object.values(D.doctors).map(d => `<option value="${d.id}">${esc(d.name)} · ${esc(d.title)}</option>`).join('')}</select></label>
    <label class="fld">Time<select name="when">${slots.map(s => `<option value="${s.toISOString()}">${esc(fmtDay(s))} at ${fmtClock(s)}</option>`).join('')}</select></label>
    <label class="fld">Reason<input name="reason" value="Check-up" maxlength="80"></label>
    <div class="row-gap"><button class="btn" type="submit">Book</button><button class="btn ghost" type="button" data-action="close-modal">Cancel</button></div></form>`);
}

function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action],[data-read]');
  if (!el) return;
  if (el.dataset.read && !el.dataset.action) { S.set(s => ({ readNotifs: [...new Set([...s.readNotifs, el.dataset.read])] })); return; }
  const a = el.dataset.action;
  if (el.tagName === 'BUTTON' || a === 'close-modal' || a === 'seek') e.preventDefault();
  const s = S.get();
  switch (a) {
    case 'close-modal': closeModal(); break;
    case 'close-modal-nav': closeModal(); location.hash = el.getAttribute('href'); break;
    case 'code': codeDialog(); break;
    case 'clear-code': setCode(''); ai = await aiStatus(true); closeModal(); render(); toast('Demo code removed'); break;
    case 'guide': guide(); break;
    case 'reset': if (confirm('Reset the demo story? Your brand choice is kept.')) { S.reset(); term.phase = 'idle'; toast('Demo reset'); render(); } break;
    case 'book': bookDialog(); break;
    case 'toggle-share': S.set({ shareVitals: !s.shareVitals }); toast(!s.shareVitals ? 'Readings shared with Dr Mokoena' : 'Readings are now private'); break;
    case 'cancel-appt': S.set({ cancelled: [...s.cancelled, el.dataset.id] }); S.notify({ kind: 'appointment', title: 'Appointment cancelled', body: 'The practice has been told.' }); toast('Appointment cancelled'); break;
    case 'read-all': S.set({ readNotifs: notifications().map(n => n.id) }); break;
    case 'send-script': S.set({ scriptSentTo: 'Rosebank Pharmacy' }); S.notify({ kind: 'script', title: 'Script sent to Rosebank Pharmacy', body: 'Ms Priya Naidoo will message you when it is ready to collect.', link: '#/patient/records' }); toast('Prescription sent to the pharmacy'); break;
    case 'share-cert': if (!s.certShared) { S.set({ certShared: true }); toast('Certificate shared with HR (no diagnosis)'); } break;
    case 'translate': {
      el.disabled = true; el.textContent = 'Translating…';
      try {
        const out = await ask(`Translate this patient visit summary into ${s.lang}. Keep it plain and warm, keep numbers and medicine names unchanged. Return only the translation.\n\n${el.dataset.id === 'rec-lerato' ? D.draft.summary : D.kneeVisit.summary}`, { tier: 'fast' });
        S.set(x => ({ translations: { ...x.translations, [el.dataset.id + ':' + s.lang]: out.trim() } }));
      } catch (err) { toast(err.message, 'bad'); el.disabled = false; el.textContent = 'Translate with live AI'; if (!getCode()) codeDialog(); }
      break;
    }
    case 'play': if (player) player.toggle(); break;
    case 'seek': if (player) { const r = el.getBoundingClientRect(); player.seek((e.clientX - r.left) / r.width * player.duration); } break;
    case 'seek-line': if (player) { player.seek(parseFloat(el.dataset.t) + 0.01); if (!player.playing) player.play(); } break;
    case 'lock-scribe': S.set({ scribeLocked: !s.scribeLocked }); toast(!s.scribeLocked ? 'Scribe locked; recordings on it are protected' : 'Scribe unlocked'); break;
    case 'regen': {
      el.disabled = true; el.textContent = 'Generating…';
      try {
        const tx = lines.map(l => `${l.who}: ${l.text}`).join('\n');
        const out = await ask(`You are CyberHealth's clinical scribe for a South African GP. Write a concise SOAP note from this consultation transcript, in the doctor's clinical style. Do not invent findings that were not said. Return JSON only: {"S":"...","O":"...","A":"...","P":"..."}\n\nTranscript:\n${tx}`);
        const j = parseJson(out);
        if (!j || !j.S) throw new Error('The AI reply could not be read. Try again.');
        S.set({ noteEdits: { S: j.S, O: j.O, A: j.A, P: j.P }, aiNote: true }); toast('Draft regenerated with live AI');
      } catch (err) { toast(err.message, 'bad'); el.disabled = false; el.textContent = 'Regenerate with live AI'; if (!getCode()) codeDialog(); }
      break;
    }
    case 'sign': {
      const edits = {}; document.querySelectorAll('[data-note]').forEach(t => { edits[t.dataset.note] = t.value; });
      S.set({ noteEdits: edits, signed: true, signedAt: new Date().toISOString() });
      toast('Signed and sent to Lerato\'s app'); break;
    }
    case 'sign-other': S.set({ otherSigned: [...s.otherSigned, el.dataset.id] }); toast('Signed'); break;
    case 'export-csv': {
      const rows = [['Employee', 'Checked in', 'Site']].concat(STAFF.map((n, i) => [n, fmtClock(D.at(0, 7, 12 + i * 4)), D.employer.sites[i % 3].name]));
      download('attendance-' + D.today.toISOString().slice(0, 10) + '.csv', rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv'); break;
    }
    case 'k-kind': term.kind = el.dataset.v; render(); break;
    case 'k-place': if (['idle', 'done', 'recorded', 'retry'].includes(term.phase)) termRun(); break;
    case 'preset': draftBrand = null; window.CHBrand.usePreset(el.dataset.id); break;
    case 'export-brand': download('brand-config.json', JSON.stringify(window.CHBrand.preview(draftBrand), null, 2), 'application/json'); break;
    case 'print': window.print(); break;
  }
});

document.addEventListener('change', e => {
  const k = e.target.dataset.change; if (!k) return;
  if (k === 'lang') S.set({ lang: e.target.value });
  if (k === 'rate' && player) player.setRate(parseFloat(e.target.value));
  if (k === 'k-who') { term.who = e.target.value; render(); }
  if (k === 'k-poor') term.poor = e.target.checked;
  if (k === 'k-low') term.low = e.target.checked;
  if (k === 'logo') {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 300 * 1024) { toast('Please use a logo under 300 KB', 'bad'); e.target.value = ''; return; }
    const r = new FileReader(); r.onload = () => { draftBrand = { ...draftBrand, logo: r.result }; render(); }; r.readAsDataURL(f);
  }
});

document.addEventListener('input', e => {
  const k = e.target.dataset.input;
  if (k === 'brand') {
    const f = e.target.form; draftBrand = { ...draftBrand, name: f.name.value, domain: f.domain.value, tagline: f.tagline.value, color: f.color.value };
    const pos = e.target.selectionStart; const nm = e.target.name;
    render(); const again = document.querySelector(`[data-form=brand] [name=${nm}]`); if (again) { again.focus(); if (pos != null && again.setSelectionRange && again.type !== 'color') again.setSelectionRange(pos, pos); }
  }
  if (k === 'tx-search') {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('.tx.live li').forEach(li => { li.hidden = q && !li.textContent.toLowerCase().includes(q); });
  }
  if (e.target.dataset.note) {
    const edits = { ...note() }; document.querySelectorAll('[data-note]').forEach(t => { edits[t.dataset.note] = t.value; });
    S.set({ noteEdits: edits }, true);
  }
});

document.addEventListener('submit', async e => {
  const f = e.target; const k = f.dataset.form; if (!k) return; e.preventDefault();
  if (k === 'code') {
    setCode(f.code.value.trim()); ai = await aiStatus(true); closeModal(); render();
    toast(ai.ai ? 'Live AI is on' : (ai.keyConfigured === false ? 'Live AI is not configured on this server' : 'Code not recognised'), ai.ai ? '' : 'bad');
  }
  if (k === 'book') {
    const item = { id: 'b' + Date.now(), with: f.with.value, when: f.when.value, status: 'Booked', reason: f.reason.value || 'Visit', place: D.doctors[f.with.value].practice.name };
    S.set(s => ({ booked: [...s.booked, item] }));
    S.notify({ kind: 'appointment', title: 'Appointment confirmed', body: `${D.doctors[item.with].name}, ${fmtDay(item.when)} at ${fmtClock(item.when)}.`, link: '#/patient/visits' });
    closeModal(); toast('Booked');
  }
  if (k === 'brand') {
    if (!draftBrand.name.trim()) { toast('Add a product name', 'bad'); return; }
    window.CHBrand.useCustom(draftBrand);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
  if (e.target.classList && e.target.classList.contains('wave') && player) {
    if (e.key === 'ArrowRight') player.seek(player.pos + 5);
    if (e.key === 'ArrowLeft') player.seek(player.pos - 5);
    if (e.key === ' ') { e.preventDefault(); player.toggle(); }
  }
});

window.addEventListener('hashchange', () => { closeModal(); render(); const m = $('#main'); if (m) window.scrollTo(0, 0); });
S.on(() => { const r = route(); if (r.role === 'doctor' && document.activeElement && document.activeElement.dataset && document.activeElement.dataset.note) return; render(); });

render();
aiStatus().then(st => { ai = st; $('#topbar').innerHTML = topbar(route().role); });
