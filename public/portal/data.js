// CyberHealth demo data. Everyone here is fictional. Dates are relative to today so the demo always looks current.

const DAY = 86400000;
export const today = new Date(); today.setHours(0, 0, 0, 0);
export const at = (offsetDays, h = 0, m = 0) => { const d = new Date(today.getTime() + offsetDays * DAY); d.setHours(h, m, 0, 0); return d; };

// Workday before today (skips weekends) for the illness dip.
function prevWorkday(n) { let d = 0, c = 0; while (c < n) { d--; const w = at(d).getDay(); if (w !== 0 && w !== 6) c++; } return d; }

export const practice = {
  name: 'Rosebank Family Practice', address: '12 Tyrwhitt Avenue, Rosebank, Johannesburg', practiceNo: '0000000 (demo)', phone: '011 000 0000 (demo)'
};

export const employer = {
  name: 'Highveld Logistics', note: 'fictional company',
  sites: [
    { id: 'T-01', name: 'Head office · Midrand', status: 'online', lastSeen: 'now', checkinsToday: 54 },
    { id: 'T-02', name: 'Depot · Germiston', status: 'online', lastSeen: '2 min ago', checkinsToday: 41 },
    { id: 'T-03', name: 'Depot · Pretoria West', status: 'offline', lastSeen: 'today 06:12', checkinsToday: 26, issue: 'No network since 06:12; check-ins are stored on the terminal and will sync' }
  ],
  employees: 148, optedIn: 93
};

export const doctors = {
  mokoena: { id: 'mokoena', name: 'Dr Thandi Mokoena', title: 'General practitioner', hpcsa: 'MP 0000001 (demo)', practice },
  patel: { id: 'patel', name: 'Dr Ayesha Patel', title: 'Orthopaedic surgeon', hpcsa: 'MP 0000002 (demo)', practice: { ...practice, name: 'Sandton Specialist Centre' } },
  botha: { id: 'botha', name: 'Dr Johan Botha', title: 'Dentist', hpcsa: 'DP 0000003 (demo)', practice: { ...practice, name: 'Parkhurst Dental' } },
  naidoo: { id: 'naidoo', name: 'Ms Priya Naidoo', title: 'Pharmacist', hpcsa: 'SAPC P0000004 (demo)', practice: { ...practice, name: 'Rosebank Pharmacy' } }
};

export const patient = {
  id: 'lerato', name: 'Lerato Dlamini', first: 'Lerato', age: 34, sex: 'Female', idNo: '9205 0000 000 00 (demo)',
  employer: 'Highveld Logistics', role: 'Operations coordinator', medicalAid: 'Demo Medical Scheme · Classic', memberNo: 'DMS 000 1234',
  allergies: ['Penicillin (rash)'], conditions: ['Asthma since childhood'], meds: ['Salbutamol inhaler as needed'],
  language: 'English', phone: '082 000 0000 (demo)'
};

// ---------- workplace check-ins (SpO2 and pulse), last ~30 days ----------
function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export function baseCheckins() {
  const r = rand(42), list = [];
  const dip = prevWorkday(2);         // two workdays ago she felt ill at work
  for (let d = -32; d <= -1; d++) {
    const day = at(d);
    const wd = day.getDay();
    if (wd === 0 || wd === 6) continue;
    if (d > dip) continue;            // booked off after the dip; consult is today
    let spo2 = 97 + Math.round(r() * 2), pulse = 64 + Math.round(r() * 12), quality = 'good';
    if (d === dip) { spo2 = 94; pulse = 96; }
    else if (d === dip - 1) { spo2 = 96; pulse = 84; }
    if (r() < 0.07 && d !== dip) quality = 'retried';
    const t = at(d, 7, 40 + Math.round(r() * 30));
    list.push({ id: 'c' + d, time: t.toISOString(), site: 'Head office · Midrand', terminal: 'T-01', type: 'Check in', spo2, pulse, quality });
    list.push({ id: 'o' + d, time: at(d, 16, 30 + Math.round(r() * 40)).toISOString(), site: 'Head office · Midrand', terminal: 'T-01', type: 'Check out', spo2: null, pulse: null });
  }
  return list;
}
export const dipDay = prevWorkday(2);

// ---------- today's GP consult (recorded on the Scribe) ----------
export const consult = {
  id: 'rec-lerato', patient: 'lerato', doctor: 'mokoena', start: at(0, 9, 10).toISOString(), duration: 0,
  reason: 'Cough, fever and wheeze for 4 days', device: 'CyberHealth Scribe · CH-S-000231',
  consent: { by: 'Lerato Dlamini', at: at(0, 9, 9).toISOString(), purposes: ['Recording for clinical notes', 'AI drafting reviewed by the doctor'] },
  transcript: [
    ['Doctor', 'Morning Lerato, come in. Before we start, are you happy for me to record our consultation on the Scribe so the notes are written for me? Only I review them.'],
    ['Patient', 'Yes, that\'s fine, Doctor.'],
    ['Doctor', 'Thank you. So what brings you in today?'],
    ['Patient', 'I\'ve had this cough for about four days now. It started with a sore throat, and now I\'m coughing up yellowish phlegm.'],
    ['Doctor', 'Any fever?'],
    ['Patient', 'Yes, two nights ago it was thirty-eight point two. And I\'m wheezing at night, I\'ve been using my blue pump about three times a day.'],
    ['Doctor', 'Normally how often do you need the pump?'],
    ['Patient', 'Maybe once a month. Hardly ever.'],
    ['Doctor', 'Any chest pain, or coughing up blood? Short of breath when you\'re resting?'],
    ['Patient', 'No blood, no pain. Just tight when I cough a lot. Oh, and the check-in machine at work said my oxygen was ninety-four the other day. I shared it to the app.'],
    ['Doctor', 'Yes, I can see it here, ninety-four with a pulse of ninety-six. Your usual is ninety-seven, ninety-eight. Any allergies I should know about?'],
    ['Patient', 'Penicillin. I get a rash.'],
    ['Doctor', 'Noted. Let me examine you. Temperature thirty-seven point eight, pulse ninety-two, oxygen ninety-six percent in the room. Breathe in and out for me... I can hear some wheezing on both sides, but no crackles.'],
    ['Patient', 'Is it a chest infection? Do I need antibiotics?'],
    ['Doctor', 'It looks like acute bronchitis, most likely viral, and it\'s set off your asthma a bit. Antibiotics won\'t help a virus, and with your penicillin allergy I\'d rather not give one we don\'t need.'],
    ['Patient', 'Okay.'],
    ['Doctor', 'Use the salbutamol pump, two puffs every four to six hours when you\'re tight, with a spacer. Paracetamol for the fever, two tablets up to four times a day. Lots of fluids and rest.'],
    ['Patient', 'Can I get a sick note? I work in the office at the depot.'],
    ['Doctor', 'Yes, I\'ll give you three days off, starting today, and you can go back after that if the fever has settled.'],
    ['Doctor', 'Come straight back, or go to casualty, if you\'re breathless at rest, your oxygen reading drops below ninety-two, you get chest pain, or the fever lasts three more days.'],
    ['Patient', 'Alright. And if it\'s not better?'],
    ['Doctor', 'Let\'s book a follow-up in ten days to check your chest and your asthma control. Reception will send it to your app.'],
    ['Patient', 'Thank you, Doctor.'],
    ['Doctor', 'Pleasure. Feel better, Lerato.']
  ]
};

// Estimate timings for each line (seconds) from word count.
export function timeline(lines, start = 3) {
  let t = start; const out = [];
  for (const [who, text] of lines) {
    const d = Math.max(2.2, text.split(/\s+/).length / 2.6) + 0.6;
    out.push({ who, text, t0: t, t1: t + d }); t += d;
  }
  return out;
}

// ---------- the AI draft for today's consult (what the doctor reviews and signs) ----------
export const draft = {
  note: {
    S: 'Four days of productive cough (yellow sputum) after a sore throat. Fever up to 38.2 °C two nights ago. Nocturnal wheeze; salbutamol use up to three times a day (usually once a month). No chest pain, haemoptysis or breathlessness at rest. Workplace check-in two days ago: SpO₂ 94 %, pulse 96 (shared by patient; usual SpO₂ 97–98 %). Known asthma since childhood. Allergy: penicillin (rash). Non-smoker; office worker.',
    O: 'T 37.8 °C, HR 92, SpO₂ 96 % on room air. Chest: bilateral expiratory wheeze, no crackles. Not in respiratory distress.',
    A: 'Acute bronchitis, probably viral (J20.9), with a mild asthma flare (J45.9).',
    P: 'No antibiotic indicated (viral picture; penicillin allergy noted). Salbutamol 100 mcg MDI with spacer, 2 puffs 4–6-hourly as needed. Paracetamol 500 mg, 2 tablets 6-hourly as needed for fever (max 8 a day). Fluids and rest. Unfit for work for 3 days. Red flags explained: breathlessness at rest, SpO₂ below 92 %, chest pain, or fever beyond 3 more days. Follow-up in 10 days to review asthma control.'
  },
  codes: [
    { code: 'J20.9', label: 'Acute bronchitis, unspecified', role: 'Primary', confidence: 0.94 },
    { code: 'J45.9', label: 'Asthma, unspecified', role: 'Secondary', confidence: 0.88 }
  ],
  script: [
    { drug: 'Salbutamol 100 mcg/dose inhaler', directions: '2 puffs with spacer every 4 to 6 hours when needed for wheeze', qty: '1 inhaler (200 doses)', repeats: 1 },
    { drug: 'Paracetamol 500 mg tablets', directions: '2 tablets every 6 hours when needed for fever or pain. No more than 8 tablets in 24 hours', qty: '20 tablets', repeats: 0 }
  ],
  certificate: { fromOffset: 0, days: 3, reason: 'Acute respiratory illness (disclosed with the patient\'s consent)' },
  followUp: { offset: 10, time: [9, 30], with: 'mokoena', reason: 'Follow-up: chest and asthma control' },
  safety: [
    { level: 'ok', title: 'Penicillin allergy respected', detail: 'No penicillin-class antibiotic on the script.' },
    { level: 'ok', title: 'Workplace SpO₂ reading documented', detail: '94 % two days ago is recorded in the history; 96 % today.' },
    { level: 'info', title: 'Asthma is a Chronic Disease List (PMB) condition', detail: 'Consider registering Lerato on her scheme\'s chronic programme so her inhalers are covered from PMB benefits.' },
    { level: 'warn', title: 'Reliever use above usual', detail: 'Using salbutamol 3× a day. If it continues after the infection, review controller therapy at follow-up.' }
  ],
  summary: 'You have acute bronchitis, a chest infection that is almost always caused by a virus, and it has made your asthma flare a little. Antibiotics do not help viruses, so you don\'t need one. Use your blue pump (2 puffs with the spacer every 4 to 6 hours when you feel tight) and paracetamol for fever. Drink plenty of fluids and rest. You are booked off work for 3 days. Get help straight away if you are short of breath while resting, your oxygen reading drops below 92 %, you have chest pain, or the fever lasts 3 more days. Your follow-up visit is in 10 days.'
};

// ---------- other recordings in the doctor's Scribe inbox ----------
export const otherRecordings = [
  {
    id: 'rec-pieter', patientName: 'Pieter Joubert', age: 51, reason: 'Lower back pain after lifting', start: at(0, 10, 5).toISOString(), status: 'Ready to review',
    transcript: [
      ['Doctor', 'Pieter, before we start, may I record this consult on the Scribe for my notes?'],
      ['Patient', 'Sure, go ahead.'],
      ['Doctor', 'Tell me about the back.'],
      ['Patient', 'I lifted a box of tiles on Saturday and felt it go in my lower back. It doesn\'t go down my leg.'],
      ['Doctor', 'Any numbness, weakness, trouble passing urine?'],
      ['Patient', 'No, nothing like that.'],
      ['Doctor', 'Good. It sounds like a muscle strain. Keep moving gently, use heat, and I\'ll give you an anti-inflammatory for five days.']
    ],
    note: 'S: Acute mechanical low back pain after lifting 3 days ago; no radicular pain; no red flags (no saddle anaesthesia, bladder or bowel change, weakness). O: Paraspinal tenderness L4–L5, full power, SLR negative. A: Lumbar strain (S39.0). P: Ibuprofen 400 mg 8-hourly with food for 5 days; heat; stay active; review if not improving in 2 weeks or red flags develop.'
  },
  {
    id: 'rec-nomsa', patientName: 'Nomsa Khumalo', age: 58, reason: 'Blood pressure review', start: at(0, 10, 40).toISOString(), status: 'Drafting',
    transcript: [
      ['Doctor', 'Nomsa, may I record our consultation for the notes?'],
      ['Patient', 'Yes, Doctor.'],
      ['Doctor', 'How have the blood pressure tablets been?'],
      ['Patient', 'Fine, but my ankles swell a bit in the afternoon.']
    ],
    note: 'Drafting: the Scribe uploaded this recording 2 minutes ago.'
  }
];

// ---------- appointments ----------
export function baseAppointments() {
  return [
    { id: 'a-today', with: 'mokoena', when: at(0, 9, 10).toISOString(), status: 'Completed', reason: 'Cough, fever and wheeze', place: practice.name, consult: 'rec-lerato' },
    { id: 'a-dental', with: 'botha', when: at(24, 14, 0).toISOString(), status: 'Booked', reason: 'Six-monthly check-up', place: 'Parkhurst Dental' },
    { id: 'a-knee', with: 'patel', when: at(-84, 11, 0).toISOString(), status: 'Completed', reason: 'Right knee pain after running', place: 'Sandton Specialist Centre', consult: 'rec-knee' }
  ];
}

export const kneeVisit = {
  id: 'rec-knee', doctor: 'patel', start: at(-84, 11, 0).toISOString(), reason: 'Right knee pain after running',
  transcript: [
    ['Doctor', 'Lerato, may I record this consultation for my notes?'],
    ['Patient', 'Yes, that\'s fine.'],
    ['Doctor', 'Where exactly is the pain?'],
    ['Patient', 'Around the kneecap, worse going down stairs and after my 10 k runs.'],
    ['Doctor', 'No locking or giving way? Okay, this is patellofemoral pain. Physio for six weeks, and cut your running distance in half for now.']
  ],
  summary: 'Your knee pain comes from the joint behind the kneecap (patellofemoral pain). It is common in runners and gets better with exercises. See the physiotherapist for 6 weeks and halve your running distance for now. Ice after exercise helps.',
  note: 'S: 6 weeks anterior right knee pain, worse on stairs and after running; no locking or instability. O: Patellar grind positive, ligaments stable, no effusion. A: Patellofemoral pain syndrome, right (M22.2). P: Physiotherapy referral 6 weeks; reduce running load 50 %; ice; review if not improving.',
  codes: [{ code: 'M22.2', label: 'Patellofemoral disorders', role: 'Primary' }],
  script: [{ drug: 'Ibuprofen 400 mg tablets', directions: '1 tablet 8-hourly with food when needed, for up to 5 days', qty: '15 tablets', repeats: 0 }],
  letters: ['Referral to physiotherapy (Rosebank Physio)']
};

// ---------- notifications (base, before the doctor signs) ----------
export function baseNotifications() {
  return [
    { id: 'n-dip', at: at(dipDay, 7, 52).toISOString(), kind: 'vitals', title: 'Your SpO₂ was lower than usual', body: 'This morning\'s check-in read 94 % (your usual range is 97–98 %). If you feel short of breath or unwell, see a doctor. You can share this reading with them in the app.' },
    { id: 'n-book', at: at(-1, 18, 5).toISOString(), kind: 'appointment', title: 'Appointment confirmed', body: 'Dr Thandi Mokoena, today at 09:10, Rosebank Family Practice.' },
    { id: 'n-remind', at: at(0, 7, 30).toISOString(), kind: 'appointment', title: 'Reminder: appointment at 09:10', body: 'Bring your medical aid card. Your shared check-in readings are already with Dr Mokoena.' },
    { id: 'n-dental', at: at(-3, 10, 0).toISOString(), kind: 'appointment', title: 'Dental check-up booked', body: 'Dr Johan Botha in 24 days at 14:00.' }
  ];
}

export const languages = ['English', 'isiZulu', 'isiXhosa', 'Afrikaans', 'Sesotho', 'Setswana'];
