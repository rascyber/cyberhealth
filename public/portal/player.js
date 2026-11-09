// Scribe recording player: plays the consult and keeps the transcript in step.
// Uses a real recording from /audio/<id>.mp3 when one exists; otherwise the browser voices the
// transcript (demo audio), and if the browser has no voices it plays silently with the timeline.
export class ScribePlayer {
  constructor(id, lines, { onTick, onState } = {}) {
    this.id = id; this.lines = lines; this.onTick = onTick || (() => {}); this.onState = onState || (() => {});
    this.duration = lines.length ? lines[lines.length - 1].t1 + 1 : 0;
    this.pos = 0; this.playing = false; this.rate = 1; this.mode = 'pending'; this.idx = 0; this.raf = 0;
    this.ready = this._detect();
  }

  async _detect() {
    try {
      const r = await fetch('/audio/' + this.id + '.mp3', { method: 'HEAD', cache: 'no-store' });
      const type = r.headers.get('content-type') || '';
      if (r.ok && type.indexOf('audio') !== -1) {
        this.audio = new Audio('/audio/' + this.id + '.mp3');
        await new Promise(res => { this.audio.addEventListener('loadedmetadata', res, { once: true }); this.audio.addEventListener('error', res, { once: true }); });
        if (this.audio.duration && isFinite(this.audio.duration)) {
          const k = this.audio.duration / this.duration;            // stretch line timings to the real recording
          this.lines = this.lines.map(l => ({ ...l, t0: l.t0 * k, t1: l.t1 * k }));
          this.duration = this.audio.duration;
          this.audio.addEventListener('ended', () => this._end());
          this.mode = 'file'; this.onState(this); return;
        }
      }
    } catch (e) { /* no recording file */ }
    this.mode = ('speechSynthesis' in window) ? 'voice' : 'silent';
    if (this.mode === 'voice') this._pickVoices();
    this.onState(this);
  }

  _pickVoices() {
    const pick = () => {
      const all = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
      const rank = v => (/en-ZA/i.test(v.lang) ? 0 : /en-GB/i.test(v.lang) ? 1 : 2) + (/natural|neural|google|microsoft/i.test(v.name) ? -0.5 : 0);
      all.sort((a, b) => rank(a) - rank(b));
      this.voices = { Doctor: all[0] || null, Patient: all[1] || all[0] || null };
      if (!all.length) this.mode = 'silent';
    };
    pick();
    if (!this.voices || !this.voices.Doctor) speechSynthesis.addEventListener('voiceschanged', () => { if (this.mode !== 'file') { this.mode = 'voice'; pick(); this.onState(this); } }, { once: true });
  }

  lineAt(t) { let i = this.lines.findIndex(l => t < l.t1); return i === -1 ? this.lines.length - 1 : i; }

  play() {
    if (this.playing) return;
    if (this.pos >= this.duration - 0.5) this.pos = 0;
    this.playing = true; this.onState(this);
    if (this.mode === 'file') { this.audio.currentTime = this.pos; this.audio.playbackRate = this.rate; this.audio.play(); }
    else if (this.mode === 'voice') this._speakFrom(this.lineAt(this.pos));
    this._lastT = performance.now();
    this._loop();
  }

  pause() {
    this.playing = false;
    if (this.mode === 'file') this.audio.pause();
    if (this.mode === 'voice') { this._cancelled = true; speechSynthesis.cancel(); }
    cancelAnimationFrame(this.raf); this.onState(this);
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  seek(t) {
    this.pos = Math.max(0, Math.min(this.duration, t));
    if (this.mode === 'file') this.audio.currentTime = this.pos;
    if (this.playing && this.mode === 'voice') { this._cancelled = true; speechSynthesis.cancel(); setTimeout(() => this._speakFrom(this.lineAt(this.pos)), 60); }
    this.onTick(this.pos, this.lineAt(this.pos));
  }

  setRate(r) {
    this.rate = r;
    if (this.mode === 'file') this.audio.playbackRate = r;
    if (this.playing && this.mode === 'voice') this.seek(this.lines[this.lineAt(this.pos)].t0);
    this.onState(this);
  }

  _speakFrom(i) {
    if (!this.playing || i >= this.lines.length) return;
    this._cancelled = false; this.idx = i;
    const line = this.lines[i];
    if (this.pos < line.t0 || this.pos > line.t1) this.pos = line.t0;
    const u = new SpeechSynthesisUtterance(line.text);
    const v = this.voices && this.voices[line.who];
    if (v) u.voice = v;
    u.rate = this.rate; u.pitch = line.who === 'Patient' ? 1.12 : 0.95;
    u.onend = () => {
      if (this._cancelled || !this.playing) return;
      this.pos = line.t1;
      if (i + 1 < this.lines.length) this._speakFrom(i + 1); else this._end();
    };
    speechSynthesis.speak(u);
  }

  _loop() {
    const step = now => {
      if (!this.playing) return;
      const dt = (now - this._lastT) / 1000; this._lastT = now;
      if (this.mode === 'file') this.pos = this.audio.currentTime;
      else if (this.mode === 'voice') { const l = this.lines[this.idx]; this.pos = Math.min(this.pos + dt * this.rate, l ? l.t1 - 0.05 : this.duration); }
      else { this.pos += dt * this.rate; if (this.pos >= this.duration) { this._end(); return; } }
      this.onTick(this.pos, this.lineAt(this.pos));
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  _end() { this.playing = false; this.pos = this.duration; cancelAnimationFrame(this.raf); this.onTick(this.pos, this.lines.length - 1); this.onState(this); }

  destroy() { this.pause(); if (this.audio) this.audio.src = ''; }
}

export const fmtTime = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
