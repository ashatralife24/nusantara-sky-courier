// Nusantara Sky Courier — game.js
// Loop utama + state game: title, flying, landed, crashed, complete.
// Misi: lewati ring berurutan, lalu mendarat di landasan.
// v2 (TASK 021, riset UX): mode Santai/Tantang, variasi ring + angin
// per run, juice ring (partikel/popup/shake), skor terbaik, layar akhir
// dengan grade + alasan crash yang spesifik.
(function (global) {
  'use strict';

  var R = global.NSC_RANDOM;
  var CFG = global.NSC_CONFIG;
  var WORLD = global.NSC_WORLD;
  var PHYSICS = global.NSC_PHYSICS;

  var CRASH_TIPS = {
    speed: 'Kurangi gas sebelum touchdown — target di bawah 48 m/s.',
    steep: 'Turun lebih pelan — jaga V/S di atas -10 m/s, flare sebelum menyentuh tanah.',
    terrain: 'Terbang lebih tinggi di atas bukit — jaga AGL di atas 55 m.',
    time: 'Waktu habis — ambil jalur ring yang lebih langsung.'
  };
  var CRASH_LABELS = {
    speed: 'Terlalu cepat saat mendarat',
    steep: 'Turun terlalu curam',
    terrain: 'Menabrak bukit / tanah',
    time: 'Waktu misi habis'
  };

  function loadBest() {
    try {
      var v = parseInt(global.localStorage.getItem('nsc-best-score') || '0', 10);
      return isNaN(v) ? 0 : v;
    } catch (e) { return 0; }
  }

  function saveBest(v) {
    try { global.localStorage.setItem('nsc-best-score', String(v)); } catch (e) { /* abaikan */ }
  }

  function createGame(canvas, renderer, input, audio) {
    var plane = PHYSICS.createPlane();
    var status = 'title'; // title | flying | landed | crashed | complete
    var ringIndex = 0;
    var score = 0;
    var timeLeft = CFG.score.missionTimeLimitSec;
    var landingQuality = 0;
    var timeSec = 0;
    var runTimeSec = 0;
    var lastNow = 0;
    var ringFlash = 0;
    var prevRingDist = Infinity;
    var mode = 'challenge';
    var rings = CFG.rings.slice();
    var particles = []; // {x,y,z,age} ledakan saat lewati ring
    var popups = [];    // {x,y,z,age,text} teks skor melayang
    var shake = 0;
    var crashReason = null;
    var finalStats = null;
    var bestScore = loadBest();
    var isNewBest = false;

    function jitterRings() {
      var v = CFG.runVariation;
      var out = [];
      for (var i = 0; i < CFG.rings.length; i++) {
        var b = CFG.rings[i];
        var jx = (Math.random() * 2 - 1) * v.ringJitterXZ;
        var jz = (Math.random() * 2 - 1) * v.ringJitterXZ;
        var jy = (Math.random() * 2 - 1) * v.ringJitterY;
        out.push({
          x: R.clamp(b.x + jx, -1400, 1400),
          z: R.clamp(b.z + jz, -1400, 1400),
          y: Math.max(110, b.y + jy),
          r: b.r,
          label: b.label
        });
      }
      return out;
    }

    function reset(nextMode) {
      mode = nextMode || mode;
      var m = CFG.modes[mode] || CFG.modes.challenge;
      plane = PHYSICS.createPlane();
      plane.fuelScale = m.fuelScale;
      plane.landSpeedMax = m.landSpeedMax;
      // Angin ringan per run: arah acak, dorongan maks runVariation.windMax.
      var ang = Math.random() * Math.PI * 2;
      var mag = Math.random() * CFG.runVariation.windMax;
      plane.windX = Math.cos(ang) * mag;
      plane.windZ = Math.sin(ang) * mag;
      rings = jitterRings();
      status = 'flying';
      ringIndex = 0;
      score = 0;
      timeLeft = m.timeLimitSec;
      landingQuality = 0;
      runTimeSec = 0;
      ringFlash = 0;
      prevRingDist = Infinity;
      particles = [];
      popups = [];
      shake = 0;
      crashReason = null;
      finalStats = null;
      isNewBest = false;
    }

    function currentRing() {
      return rings[ringIndex] || null;
    }

    function finishRun() {
      var stats = {
        mode: mode,
        timeUsed: Math.round(runTimeSec),
        fuelLeft: Math.round(plane.fuel),
        ringsDone: ringIndex,
        score: score,
        bestScore: bestScore,
        isNewBest: false,
        landing: null,
        crashReason: crashReason
      };
      if (status === 'landed' || status === 'complete') {
        var bd = PHYSICS.landingBreakdown(plane);
        stats.landing = {
          quality: landingQuality,
          grade: PHYSICS.landingGrade(landingQuality),
          breakdown: bd
        };
      }
      if (score > bestScore) {
        bestScore = score;
        stats.bestScore = bestScore;
        stats.isNewBest = true;
        isNewBest = true;
        saveBest(bestScore);
      }
      finalStats = stats;
    }

    function update(dt) {
      timeSec += dt;
      if (status === 'title') {
        // Pesawat diam di landasan, kamera pelan berputar untuk menu.
        plane.headingDeg = (plane.headingDeg + 4 * dt) % 360;
        return;
      }
      if (status !== 'flying') return;

      runTimeSec += dt;
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        crashReason = 'time';
        status = 'crashed';
        finishRun();
        return;
      }

      PHYSICS.stepPlane(plane, input, dt);
      audio.engine(plane.throttle, plane.speed, dt);

      // Efek ring: partikel & popup menua dan hilang.
      for (var i = particles.length - 1; i >= 0; i--) {
        particles[i].age += dt;
        if (particles[i].age > 0.9) particles.splice(i, 1);
      }
      for (var j = popups.length - 1; j >= 0; j--) {
        popups[j].age += dt;
        if (popups[j].age > 1.2) popups.splice(j, 1);
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 1.4);

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
          particles.push({ x: ring.x, y: ring.y, z: ring.z, age: 0 });
          popups.push({ x: ring.x, y: ring.y, z: ring.z, age: 0, text: '+' + CFG.score.ring });
          shake = 0.35;
          ringIndex++;
          ringFlash = 1;
          audio.chime('ring', ringIndex - 1);
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
        status = ringIndex >= rings.length ? 'complete' : 'landed';
        if (landingQuality > 0.75) audio.chime('fanfare'); else audio.chime('land');
        finishRun();
        return;
      }
      if (plane.crashed) {
        crashReason = plane.crashReason || 'terrain';
        status = 'crashed';
        audio.chime('crash');
        finishRun();
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
        rings: rings,
        ringIndex: ringIndex,
        score: score,
        timeLeft: timeLeft,
        status: status,
        landingQuality: landingQuality,
        timeSec: timeSec,
        runTimeSec: runTimeSec,
        ringFlash: ringFlash,
        mode: mode,
        particles: particles,
        popups: popups,
        shake: shake,
        finalStats: finalStats,
        bestScore: bestScore,
        crashReason: crashReason,
        crashLabel: crashReason ? CRASH_LABELS[crashReason] : null,
        crashTip: crashReason ? CRASH_TIPS[crashReason] : null
      });
    }

    function tick(now) {
      var dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
      lastNow = now;
      if (status === 'title') {
        if (input.pressed('Digit1')) {
          audio.ensure();
          reset('relaxed');
        } else if (input.pressed('Enter') || input.pressed('Digit2') || input.mouse.down) {
          audio.ensure();
          reset('challenge');
        }
      } else if ((status === 'crashed' || status === 'landed' || status === 'complete') &&
        input.pressed('KeyR')) {
        reset(mode);
      }
      update(dt);
      render();
    }

    function frame(now) {
      tick(now);
      requestAnimationFrame(frame);
    }

    function start() {
      requestAnimationFrame(frame);
    }

    // Render satu frame secara sinkron (dipakai saat boot dan untuk
    // screenshot headless yang memotret sebelum rAF pertama jalan).
    function renderOnce() {
      tick((lastNow || 0) + 16);
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
      rings = CFG.rings.slice();
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
      tick: tick, // satu frame dengan waktu eksplisit (dipakai tes Node)
      applyShotPreset: applyShotPreset,
      getState: function () {
        return {
          status: status,
          score: score,
          ringIndex: ringIndex,
          rings: rings,
          mode: mode,
          plane: plane,
          timeLeft: timeLeft,
          finalStats: finalStats,
          bestScore: bestScore,
          crashReason: crashReason
        };
      }
    };
  }

  global.NSC_GAME = { createGame: createGame };
})(typeof window !== 'undefined' ? window : globalThis);
