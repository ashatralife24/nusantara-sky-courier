// Nusantara Sky Courier — game.js
// Loop utama + state game: title, flying, landed, crashed, complete.
// Misi: lewati ring berurutan, lalu mendarat di landasan.
(function (global) {
  'use strict';

  var R = global.NSC_RANDOM;
  var CFG = global.NSC_CONFIG;
  var WORLD = global.NSC_WORLD;
  var PHYSICS = global.NSC_PHYSICS;

  function createGame(canvas, renderer, input, audio) {
    var plane = PHYSICS.createPlane();
    var status = 'title'; // title | flying | landed | crashed | complete
    var ringIndex = 0;
    var score = 0;
    var timeLeft = CFG.score.missionTimeLimitSec;
    var landingQuality = 0;
    var timeSec = 0;
    var lastNow = 0;
    var ringFlash = 0;
    var prevRingDist = Infinity;

    function reset() {
      plane = PHYSICS.createPlane();
      status = 'flying';
      ringIndex = 0;
      score = 0;
      timeLeft = CFG.score.missionTimeLimitSec;
      landingQuality = 0;
      ringFlash = 0;
      prevRingDist = Infinity;
    }

    function currentRing() {
      return CFG.rings[ringIndex] || null;
    }

    function update(dt) {
      timeSec += dt;
      if (status === 'title') {
        // Pesawat diam di landasan, kamera pelan berputar untuk menu.
        plane.headingDeg = (plane.headingDeg + 4 * dt) % 360;
        return;
      }
      if (status !== 'flying') return;

      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        status = 'crashed'; // kehabisan waktu = misi gagal
        return;
      }

      PHYSICS.stepPlane(plane, input, dt);
      audio.engine(plane.throttle, plane.speed, dt);

      // Ring berikutnya.
      var ring = currentRing();
      if (ring) {
        var dx = plane.x - ring.x;
        var dy = plane.y - ring.y;
        var dz = plane.z - ring.z;
        var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (WORLD.ringPassed(plane, ring, prevRingDist)) {
          score += CFG.score.ring;
          plane.fuel = Math.min(100, plane.fuel + CFG.plane.ringFuelBonus);
          ringIndex++;
          ringFlash = 1;
          audio.chime('ring');
        }
        prevRingDist = dist;
      }
      if (ringFlash > 0) ringFlash = Math.max(0, ringFlash - dt * 1.5);

      // Mendarat.
      if (plane.landed) {
        landingQuality = PHYSICS.landingQuality(plane);
        var bonus = Math.round(CFG.score.softLanding * (0.5 + landingQuality * 0.5));
        score += bonus;
        if (landingQuality > 0.75) score += CFG.score.perfectLandingBonus;
        score += Math.round(timeLeft * CFG.score.timeBonusPerSec);
        status = ringIndex >= CFG.rings.length ? 'complete' : 'landed';
        audio.chime('land');
        return;
      }
      if (plane.crashed) {
        status = 'crashed';
        audio.chime('crash');
        return;
      }
      // Bahan bakar habis di udara = jatuh (physics sudah membuat stall).
      if (plane.fuel <= 0 && !plane.onGround && plane.y < 30) {
        // biarkan physics menabrakkan pesawat; tidak ada jalan pintas.
      }
    }

    function render() {
      renderer.render({
        plane: plane,
        rings: CFG.rings,
        ringIndex: ringIndex,
        score: score,
        timeLeft: timeLeft,
        status: status,
        landingQuality: landingQuality,
        timeSec: timeSec,
        ringFlash: ringFlash
      });
    }

    function frame(now) {
      var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
      lastNow = now;
      // Tombol global.
      if (input.pressed('KeyM')) {
        // Mute ditangani sekali per tekan via edge sederhana: cek di loop.
      }
      if (status === 'title' && (input.pressed('Enter') || input.mouse.down)) {
        audio.ensure();
        reset();
      } else if ((status === 'crashed' || status === 'landed' || status === 'complete') &&
        input.pressed('KeyR')) {
        reset();
      }
      update(dt);
      render();
      requestAnimationFrame(frame);
    }

    function start() {
      requestAnimationFrame(frame);
    }

    // Render satu frame secara sinkron (dipakai saat boot dan untuk
    // screenshot headless yang memotret sebelum rAF pertama jalan).
    function renderOnce() {
      update(0.016);
      render();
    }

    // Untuk screenshot deterministik (?shot=N): tempatkan pesawat di
    // posisi bagus, hidupkan mesin, dan langsung terbang.
    function applyShotPreset(n) {
      var presets = [
        // 1 — cover: lepas landas dari selatan landasan, Merapi + landasan di depan.
        { x: 0, y: 150, z: 1000, headingDeg: 10, pitchDeg: 3, speed: 62, throttle: 0.85, fuel: 88, ringIndex: 0 },
        // 2 — menembus ring di atas laut dangkal.
        { x: 500, y: 230, z: -80, headingDeg: 31, pitchDeg: 2, speed: 66, throttle: 0.8, fuel: 74, ringIndex: 1 },
        // 3 — di atas sawah terasering, ring ketiga di depan.
        { x: 880, y: 250, z: 260, headingDeg: 133, pitchDeg: 0, speed: 60, throttle: 0.75, fuel: 61, ringIndex: 2 },
        // 4 — final approach ke landasan, instrumen menyala.
        { x: 60, y: 95, z: 1020, headingDeg: 0, pitchDeg: -3, speed: 44, throttle: 0.45, fuel: 52, ringIndex: 6 }
      ];
      var p = presets[(n - 1) % presets.length];
      plane = PHYSICS.createPlane();
      plane.x = p.x; plane.y = p.y; plane.z = p.z;
      plane.headingDeg = p.headingDeg;
      plane.pitchDeg = p.pitchDeg;
      plane.rollDeg = n === 2 ? -14 : n === 3 ? 10 : 0;
      plane.speed = p.speed;
      plane.throttle = p.throttle;
      plane.fuel = p.fuel;
      plane.onGround = false;
      ringIndex = p.ringIndex;
      score = p.ringIndex * CFG.score.ring + 120;
      timeLeft = 300 - p.ringIndex * 30;
      status = 'flying';
      // Render beberapa frame agar terrain stabil sebelum screenshot.
      for (var i = 0; i < 3; i++) {
        PHYSICS.stepPlane(plane, {
          pitchInput: function () { return 0; },
          rollInput: function () { return 0; },
          throttleDelta: function () { return 0; }
        }, 0.016);
      }
    }

    return {
      start: start,
      reset: reset,
      renderOnce: renderOnce,
      applyShotPreset: applyShotPreset,
      getState: function () {
        return {
          status: status,
          score: score,
          ringIndex: ringIndex,
          plane: plane,
          timeLeft: timeLeft
        };
      }
    };
  }

  global.NSC_GAME = { createGame: createGame };
})(typeof window !== 'undefined' ? window : globalThis);
