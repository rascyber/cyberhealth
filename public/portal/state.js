// Shared demo state (this browser only). The doctor, patient, employer and terminal views all read it,
// so signing a record in the doctor view shows up in the patient's app straight away.
const KEY = 'ch.demo.v1';

const fresh = () => ({
  signed: false, signedAt: null, noteEdits: null, aiNote: false,
  readNotifs: [], extraNotifs: [], extraCheckins: [],
  cancelled: [], booked: [], shareVitals: true, certShared: false, scriptSentTo: null,
  lang: 'English', translations: {}, scribeLocked: false, otherSigned: []
});

let state = load();
const listeners = new Set();

function load() {
  try { return { ...fresh(), ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch (e) { return fresh(); }
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ } }

export const S = {
  get: () => state,
  set(patch, quiet) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    persist();
    if (!quiet) listeners.forEach(f => f(state));
  },
  notify(n) {
    const item = { id: 'x' + Date.now() + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(), ...n };
    S.set(s => ({ extraNotifs: [item, ...s.extraNotifs] }));
    return item;
  },
  reset() { state = fresh(); persist(); listeners.forEach(f => f(state)); },
  on(f) { listeners.add(f); return () => listeners.delete(f); }
};

// Keep several open tabs (e.g. doctor in one, patient in another) in step.
window.addEventListener('storage', e => { if (e.key === KEY) { state = load(); listeners.forEach(f => f(state)); } });
