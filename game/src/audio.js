// Nusantara Sky Courier — audio.js
// Suara prosedural via WebAudio (dengung mesin + bunyi ring).
// Tanpa file audio luar. Aman bila audio tidak tersedia (headless).
(function (global) {
  'use strict';

  function createAudio() {
    var ctx = null;
    var osc = null;
    var oscGain = null;
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
      } catch (e) {
        ctx = null;
      }
    }

    // Dengung mesin mengikuti throttle & kecepatan.
    function engine(throttle, speed, dt) {
      if (!ctx || muted) return;
      try {
        if (ctx.state === 'suspended') ctx.resume();
        var targetFreq = 48 + throttle * 65 + speed * 0.25;
        osc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.08);
        var targetGain = 0.015 + throttle * 0.05;
        oscGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.1);
      } catch (e) { /* abaikan */ }
    }

    function chime(kind) {
      if (!ctx || muted) return;
      try {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = kind === 'ring' ? 880 : kind === 'land' ? 523 : 220;
        g.gain.value = 0.12;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.stop(ctx.currentTime + 0.55);
      } catch (e) { /* abaikan */ }
    }

    function toggleMute() {
      muted = !muted;
      if (oscGain) oscGain.gain.value = 0;
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
