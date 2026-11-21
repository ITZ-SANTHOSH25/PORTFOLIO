/* ============================================================
   CINEMATIC AUDIO ENGINE
   Original, fully procedural soundtrack + sound design built with
   the Web Audio API. No external audio files, no copyrighted music.

   Layers:
     • Sub drone (41.2 Hz) + detuned saw pad + airy shimmer
     • Filtered wind / room tone with slow LFO movement
     • Heartbeat pulse, distant metal creaks, whispered air
     • Convolution reverb from a generated impulse response
     • SFX: typing, hover, click, whoosh, glass shatter,
            falling glass, deep impact, transition riser
   ============================================================ */
(function () {
  'use strict';

  class CinematicAudio {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicBus = null;
      this.sfxBus = null;
      this.reverb = null;
      this.reverbSend = null;
      this.noiseBuffer = null;
      this.started = false;
      this.muted = false;
      this.volume = 0.7;
      this._timers = [];
      this._nodes = [];
      this._disposed = false;
      this.onStateChange = null;
      this._lastType = 0;
    }

    /* ---------- setup ---------- */
    async start() {
      if (this.started || this._disposed) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;

      try {
        this.ctx = new AC({ latencyHint: 'interactive' });
      } catch (e) {
        return false;
      }
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch (e) {}
      }

      const ctx = this.ctx;

      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(ctx.destination);

      // gentle limiter so shatter/impact never clip
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 22;
      comp.ratio.value = 5;
      comp.attack.value = 0.004;
      comp.release.value = 0.28;
      comp.connect(this.master);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.62;
      this.musicBus.connect(comp);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.85;
      this.sfxBus.connect(comp);

      // reverb
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._impulse(3.4, 2.4);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.34;
      this.reverbSend.connect(this.reverb);
      this.reverb.connect(comp);

      this.noiseBuffer = this._noise(4);

      this._buildAmbience();

      this.started = true;
      this._rampMaster(this._targetGain(), 3.5);
      this._emit();
      return true;
    }

    _targetGain() {
      return this.muted ? 0 : Math.pow(this.volume, 1.55) * 0.92;
    }

    _rampMaster(value, time) {
      if (!this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), t);
      this.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, value), t + time);
    }

    _emit() {
      if (typeof this.onStateChange === 'function') {
        this.onStateChange({ started: this.started, muted: this.muted, volume: this.volume });
      }
    }

    /* ---------- generated buffers ---------- */
    _noise(seconds) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * seconds);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        let last = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.2 + white * 0.28;
        }
      }
      return buf;
    }

    _impulse(seconds, decay) {
      const ctx = this.ctx;
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * seconds);
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (1 - Math.exp(-i / (rate * 0.006)));
        }
      }
      return buf;
    }

    _track(node) {
      this._nodes.push(node);
      return node;
    }

    _later(fn, ms) {
      const id = setTimeout(() => {
        if (!this._disposed && this.ctx) fn();
      }, ms);
      this._timers.push(id);
      return id;
    }

    /* ---------- ambience ---------- */
    _buildAmbience() {
      const ctx = this.ctx;
      const t0 = ctx.currentTime;

      const bed = ctx.createGain();
      bed.gain.value = 0;
      bed.connect(this.musicBus);
      bed.gain.linearRampToValueAtTime(1, t0 + 8);

      // ---- low drone cluster ----
      const droneFilter = ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.value = 240;
      droneFilter.Q.value = 1.6;
      droneFilter.connect(bed);

      const droneGain = ctx.createGain();
      droneGain.gain.value = 0.30;
      droneGain.connect(droneFilter);

      const mk = (type, freq, detune, gain, dest) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = gain;
        o.connect(g);
        g.connect(dest);
        o.start(t0);
        this._track(o);
        return { osc: o, gain: g };
      };

      mk('sine', 41.2, 0, 0.55, droneGain);
      mk('sine', 41.2, 9, 0.32, droneGain);
      mk('sawtooth', 55.0, -7, 0.055, droneGain);
      mk('triangle', 82.4, 4, 0.05, droneGain);

      // slow filter breathing
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.045;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 90;
      lfo.connect(lfoGain);
      lfoGain.connect(droneFilter.frequency);
      lfo.start(t0);
      this._track(lfo);

      // ---- airy dissonant shimmer ----
      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0.016;
      const shimmerPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (shimmerPan) { shimmerPan.pan.value = -0.35; shimmerGain.connect(shimmerPan); shimmerPan.connect(bed); }
      else shimmerGain.connect(bed);

      const sh1 = ctx.createOscillator(); sh1.type = 'sine'; sh1.frequency.value = 466.16;
      const sh2 = ctx.createOscillator(); sh2.type = 'sine'; sh2.frequency.value = 493.88;
      sh1.connect(shimmerGain); sh2.connect(shimmerGain);
      sh1.start(t0); sh2.start(t0);
      this._track(sh1); this._track(sh2);

      const trem = ctx.createOscillator();
      trem.frequency.value = 0.11;
      const tremGain = ctx.createGain();
      tremGain.gain.value = 0.011;
      trem.connect(tremGain);
      tremGain.connect(shimmerGain.gain);
      trem.start(t0);
      this._track(trem);

      // ---- wind / room tone ----
      const wind = ctx.createBufferSource();
      wind.buffer = this.noiseBuffer;
      wind.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 480;
      windFilter.Q.value = 0.7;
      const windGain = ctx.createGain();
      windGain.gain.value = 0.085;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(bed);
      wind.start(t0);
      this._track(wind);

      const windLfo = ctx.createOscillator();
      windLfo.frequency.value = 0.032;
      const windLfoGain = ctx.createGain();
      windLfoGain.gain.value = 260;
      windLfo.connect(windLfoGain);
      windLfoGain.connect(windFilter.frequency);
      windLfo.start(t0);
      this._track(windLfo);

      // ---- heartbeat ----
      this._heartbeatLoop();

      // ---- random distant events ----
      this._scheduleCreak();
      this._scheduleWhisper();
    }

    _heartbeatLoop() {
      const beat = () => {
        if (this._disposed || !this.ctx) return;
        const t = this.ctx.currentTime;
        this._thump(t, 0.30);
        this._thump(t + 0.30, 0.19);
        this._later(beat, 2200 + Math.random() * 1400);
      };
      this._later(beat, 1400);
    }

    _thump(t, level) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(62, t);
      o.frequency.exponentialRampToValueAtTime(26, t + 0.42);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + 0.035);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      o.connect(g); g.connect(lp); lp.connect(this.musicBus);
      o.start(t); o.stop(t + 0.7);
    }

    _scheduleCreak() {
      this._later(() => {
        if (this._disposed) return;
        this._creak();
        this._scheduleCreak();
      }, 9000 + Math.random() * 12000);
    }

    _creak() {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.playbackRate.value = 0.7 + Math.random() * 0.5;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 11;
      const f0 = 700 + Math.random() * 900;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 1.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.075, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) pan.pan.value = Math.random() * 1.6 - 0.8;
      src.connect(bp); bp.connect(g);
      if (pan) { g.connect(pan); pan.connect(this.musicBus); pan.connect(this.reverbSend); }
      else { g.connect(this.musicBus); g.connect(this.reverbSend); }
      src.start(t); src.stop(t + 2.2);
    }

    _scheduleWhisper() {
      this._later(() => {
        if (this._disposed) return;
        this._whisper();
        this._scheduleWhisper();
      }, 14000 + Math.random() * 16000);
    }

    _whisper() {
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3.2;
      bp.frequency.setValueAtTime(1100, t);
      bp.frequency.linearRampToValueAtTime(1900, t + 1.1);
      bp.frequency.linearRampToValueAtTime(900, t + 2.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) pan.pan.value = Math.random() * 1.8 - 0.9;
      src.connect(bp); bp.connect(g);
      if (pan) { g.connect(pan); pan.connect(this.musicBus); pan.connect(this.reverbSend); }
      else { g.connect(this.musicBus); g.connect(this.reverbSend); }
      src.start(t); src.stop(t + 2.8);
    }

    /* ---------- utility ---------- */
    _env(node, t, attack, hold, release, peak) {
      const g = node.gain;
      g.setValueAtTime(0.0001, t);
      g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
      if (hold > 0) g.setValueAtTime(Math.max(0.0002, peak), t + attack + hold);
      g.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    }

    _noiseBurst({ t, dur = 0.2, freq = 3000, q = 0.8, type = 'highpass', gain = 0.2, pan = 0, rate = 1, reverb = 0.25 }) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.playbackRate.value = rate;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      this._env(g, t, 0.004, 0, dur, gain);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(f); f.connect(g);
      if (p) { p.pan.value = pan; g.connect(p); p.connect(this.sfxBus); if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; p.connect(s); s.connect(this.reverbSend); } }
      else { g.connect(this.sfxBus); }
      src.start(t, Math.random() * 1.5);
      src.stop(t + dur + 0.1);
    }

    _ping({ t, freq = 3000, dur = 0.5, gain = 0.05, pan = 0, type = 'sine', reverb = 0.4 }) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * (0.94 + Math.random() * 0.1), t + dur);
      const g = ctx.createGain();
      this._env(g, t, 0.002, 0, dur, gain);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o.connect(g);
      if (p) { p.pan.value = pan; g.connect(p); p.connect(this.sfxBus); if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; p.connect(s); s.connect(this.reverbSend); } }
      else g.connect(this.sfxBus);
      o.start(t); o.stop(t + dur + 0.1);
    }

    /* ---------- SFX ---------- */
    typeSound() {
      if (!this.started) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      if (t - this._lastType < 0.018) return;
      this._lastType = t;
      const base = 1500 + Math.random() * 1700;
      const o = ctx.createOscillator();
      o.type = Math.random() > 0.55 ? 'square' : 'triangle';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (0.55 + Math.random() * 0.3), t + 0.045);
      const g = ctx.createGain();
      this._env(g, t, 0.002, 0, 0.055, 0.035 + Math.random() * 0.025);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = base;
      bp.Q.value = 1.2;
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o.connect(bp); bp.connect(g);
      if (p) { p.pan.value = (Math.random() - 0.5) * 0.7; g.connect(p); p.connect(this.sfxBus); }
      else g.connect(this.sfxBus);
      o.start(t); o.stop(t + 0.09);
      this._noiseBurst({ t, dur: 0.03, freq: 4200, gain: 0.018, pan: (Math.random() - 0.5) * 0.8, reverb: 0.05 });
    }

    hoverSound() {
      if (!this.started) return;
      const t = this.ctx.currentTime;
      this._ping({ t, freq: 1500 + Math.random() * 300, dur: 0.09, gain: 0.022, pan: (Math.random() - 0.5) * 0.5, type: 'sine', reverb: 0.25 });
      this._noiseBurst({ t, dur: 0.05, freq: 5200, gain: 0.012, reverb: 0.1 });
    }

    clickSound() {
      if (!this.started) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.22);
      const g = ctx.createGain();
      this._env(g, t, 0.004, 0, 0.26, 0.14);
      o.connect(g); g.connect(this.sfxBus); g.connect(this.reverbSend);
      o.start(t); o.stop(t + 0.3);
      this._noiseBurst({ t, dur: 0.09, freq: 2600, gain: 0.06, reverb: 0.2 });
    }

    whoosh(duration = 0.9) {
      if (!this.started) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.playbackRate.value = 0.85;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(180, t);
      bp.frequency.exponentialRampToValueAtTime(2800, t + duration * 0.55);
      bp.frequency.exponentialRampToValueAtTime(320, t + duration);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + duration * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      src.connect(bp); bp.connect(g);
      if (p) { p.pan.value = 0; g.connect(p); p.connect(this.sfxBus); p.connect(this.reverbSend); }
      else { g.connect(this.sfxBus); g.connect(this.reverbSend); }
      src.start(t); src.stop(t + duration + 0.1);
    }

    impact() {
      if (!this.started) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;

      // sub drop
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(105, t);
      o.frequency.exponentialRampToValueAtTime(24, t + 1.5);
      const g = ctx.createGain();
      this._env(g, t, 0.006, 0.05, 1.7, 0.42);
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = Math.tanh(x * 2.4);
      }
      shaper.curve = curve;
      o.connect(shaper); shaper.connect(g); g.connect(this.sfxBus); g.connect(this.reverbSend);
      o.start(t); o.stop(t + 1.9);

      // body noise
      this._noiseBurst({ t, dur: 0.55, freq: 220, type: 'lowpass', gain: 0.28, reverb: 0.5 });
      this._noiseBurst({ t: t + 0.01, dur: 0.25, freq: 1800, gain: 0.1, reverb: 0.6 });
    }

    glassBreak() {
      if (!this.started) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;

      this.impact();

      // shattering body — dense high noise bursts
      for (let i = 0; i < 16; i++) {
        this._noiseBurst({
          t: t + Math.random() * 0.16,
          dur: 0.07 + Math.random() * 0.22,
          freq: 1600 + Math.random() * 5200,
          q: 0.6 + Math.random() * 2,
          gain: 0.06 + Math.random() * 0.09,
          pan: (Math.random() - 0.5) * 1.7,
          rate: 0.8 + Math.random() * 0.8,
          reverb: 0.35
        });
      }

      // glass resonances
      for (let i = 0; i < 14; i++) {
        this._ping({
          t: t + Math.random() * 0.5,
          freq: 2200 + Math.random() * 5200,
          dur: 0.18 + Math.random() * 0.9,
          gain: 0.022 + Math.random() * 0.035,
          pan: (Math.random() - 0.5) * 1.8,
          type: Math.random() > 0.5 ? 'sine' : 'triangle',
          reverb: 0.6
        });
      }

      // initial crack transient
      this._noiseBurst({ t, dur: 0.04, freq: 9000, gain: 0.3, reverb: 0.3 });
      this._ping({ t, freq: 5400, dur: 0.35, gain: 0.09, type: 'triangle', reverb: 0.7 });
    }

    glassFall() {
      if (!this.started) return;
      const t0 = this.ctx.currentTime;
      const count = 22;
      for (let i = 0; i < count; i++) {
        const delay = Math.pow(Math.random(), 1.4) * 2.2;
        this._ping({
          t: t0 + delay,
          freq: 2800 + Math.random() * 6000,
          dur: 0.08 + Math.random() * 0.3,
          gain: 0.012 + Math.random() * 0.03,
          pan: (Math.random() - 0.5) * 1.9,
          type: 'sine',
          reverb: 0.5
        });
        if (i % 3 === 0) {
          this._noiseBurst({
            t: t0 + delay,
            dur: 0.05,
            freq: 5000 + Math.random() * 4000,
            gain: 0.02,
            pan: (Math.random() - 0.5) * 1.8,
            reverb: 0.3
          });
        }
      }
    }

    transition() {
      if (!this.started) return;
      this.whoosh(1.3);
      this._ping({ t: this.ctx.currentTime + 0.05, freq: 880, dur: 1.6, gain: 0.03, type: 'sine', reverb: 0.8 });
    }

    /* ---------- controls ---------- */
    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.started && !this.muted) this._rampMaster(this._targetGain(), 0.18);
      this._emit();
    }

    setMuted(m) {
      this.muted = !!m;
      if (this.started) this._rampMaster(this._targetGain(), 0.35);
      this._emit();
    }

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    suspend() {
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    }

    resume() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    dispose() {
      this._disposed = true;
      this._timers.forEach(clearTimeout);
      this._timers = [];
      if (this.ctx) {
        try { this.ctx.close(); } catch (e) {}
      }
      this.ctx = null;
      this.started = false;
    }
  }

  window.CinematicAudio = CinematicAudio;
  window.audioEngine = new CinematicAudio();
})();
