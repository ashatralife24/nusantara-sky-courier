// Nusantara Sky Courier — random.js
// RNG ber-seed + value noise 2D. Dipakai untuk terrain, awan, dan
// penempatan detail supaya dunia sama setiap kali dimuat (deterministik).
(function (global) {
  'use strict';

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Hash grid (x, z) -> [0, 1). Stabil di semua mesin.
  function hash2(ix, iz, seed) {
    var h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  // Value noise bilinear dengan interpolasi halus.
  function valueNoise(x, z, seed) {
    var ix = Math.floor(x);
    var iz = Math.floor(z);
    var fx = x - ix;
    var fz = z - iz;
    var a = hash2(ix, iz, seed);
    var b = hash2(ix + 1, iz, seed);
    var c = hash2(ix, iz + 1, seed);
    var d = hash2(ix + 1, iz + 1, seed);
    var ux = smooth(fx);
    var uz = smooth(fz);
    var ab = a + (b - a) * ux;
    var cd = c + (d - c) * ux;
    return ab + (cd - ab) * uz;
  }

  // Fractal Brownian motion: beberapa oktaf noise.
  function fbm(x, z, seed, octaves) {
    var total = 0;
    var amp = 0.5;
    var freq = 1;
    var norm = 0;
    for (var i = 0; i < octaves; i++) {
      total += amp * valueNoise(x * freq, z * freq, seed + i * 101);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return total / norm;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  function radToDeg(r) {
    return r * 180 / Math.PI;
  }

  function wrapAngleDeg(d) {
    var v = d % 360;
    if (v > 180) v -= 360;
    if (v < -180) v += 360;
    return v;
  }

  global.NSC_RANDOM = {
    mulberry32: mulberry32,
    hash2: hash2,
    valueNoise: valueNoise,
    fbm: fbm,
    clamp: clamp,
    lerp: lerp,
    degToRad: degToRad,
    radToDeg: radToDeg,
    wrapAngleDeg: wrapAngleDeg
  };
})(typeof window !== 'undefined' ? window : globalThis);
