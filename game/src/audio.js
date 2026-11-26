// Nusantara Sky Courier — audio.js
// Suara prosedural via WebAudio (dengung mesin + bunyi ring).
// Tanpa file audio luar. Aman bila audio tidak tersedia (headless).
(function (global) {
  'use strict';

  function createAudio() {
    var ctx = null;
    var osc = null;
    var oscGain = null;
    var windGain = null;
    var muted = false;
    var started = false;

    function ensure() {
      if (started) return;
      started = true;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 55;
        var filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        oscGain = ctx.createGain();
        oscGain.gain.value = 0.0;
        osc.connect(filter);
        filter.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start();
        // Angin: noise putih ber-loop lewat bandpass, gain mengikuti kecepatan.
        var len = ctx.sampleRate;
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        var noise = ctx.createBufferSource();
        noise.buffer = buf;
        noise.loop = true;
        var bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 600;
        bp.Q.value = 0.6;
        windGain = ctx.createGain();
        windGain.gain.value = 0.0;
        noise.connect(bp);
        bp.connect(windGain);
        windGain.connect(ctx.destination);
        noise.start();
      } catch (e) {
        ctx = null;
      }
    }

    // Dengung mesin mengikuti throttle & kecepatan; angin mengikuti kecepatan.
    function engine(throttle, speed, dt) {
      if (!ctx || muted) return;
      try {
        if (ctx.state === 'suspended') ctx.resume();
        var targetFreq = 48 + throttle * 65 + speed * 0.25;
        osc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.08);
        var targetGain = 0.015 + throttle * 0.05;
        oscGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.1);
        if (windGain) {
          var windTarget = Math.max(0, (speed - 30) / 62) * 0.05;
          windGain.gain.setTargetAtTime(windTarget, ctx.currentTime, 0.2);
        }
      } catch (e) { /* abaikan */ }
    }

    function tone(freq, when, dur, vol) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g);
      g.connect(ctx.destination);
      var t0 = ctx.currentTime + when;
      g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }

    // kind: 'ring' (nada naik tiap ring berurutan), 'land', 'crash',
    // 'fanfare' (mendarat sempurna: arpeggio singkat).
    function chime(kind, ringIndex) {
      if (!ctx || muted) return;
      try {
        if (kind === 'ring') {
          // Nada naik: tangga nada tiap ring (C5 -> ...), makin seru.
          var scale = [523, 587, 659, 784, 880, 1047];
          var f = scale[Math.min(ringIndex || 0, scale.length - 1)];
          tone(f, 0, 0.45, 0.14);
          tone(f * 1.5, 0.05, 0.4, 0.08);
        } else if (kind === 'fanfare') {
          tone(523, 0, 0.25, 0.12);
          tone(659, 0.12, 0.25, 0.12);
          tone(784, 0.24, 0.35, 0.12);
          tone(1047, 0.36, 0.5, 0.14);
        } else if (kind === 'land') {
          tone(523, 0, 0.5, 0.12);
        } else {
          tone(220, 0, 0.55, 0.12);
        }
      } catch (e) { /* abaikan */ }
    }

    function toggleMute() {
      muted = !muted;
      if (oscGain) oscGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return muted;
    }

    return {
      ensure: ensure,
      engine: engine,
      chime: chime,
      toggleMute: toggleMute
    };
  }

  global.NSC_AUDIO = { createAudio: createAudio };
})(typeof window !== 'undefined' ? window : globalThis);
