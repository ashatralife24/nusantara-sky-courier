// Nusantara Sky Courier — physics.js
// Model terbang arcade: throttle -> kecepatan, pitch -> naik/turun,
// roll -> belok. Ada stall, bahan bakar, tabrakan tanah, dan pendaratan.
(function (global) {
  'use strict';

  var R = global.NSC_RANDOM;
  var CFG = global.NSC_CONFIG;
  var WORLD = global.NSC_WORLD;

  function createPlane() {
    return {
      // Posisi awal: di ujung selatan landasan, siap lepas landas.
      x: 0, y: 42, z: 820,
      headingDeg: 0,   // 0 = utara
      pitchDeg: 0,
      rollDeg: 0,
      speed: 0,
      throttle: 0,
      fuel: CFG.plane.startFuel,
      damage: 0,
      verticalSpeed: 0,
      onGround: true,
      landed: false,
      crashed: false,
      crashReason: null, // 'speed' | 'steep' | 'terrain' — diisi saat tabrakan
      airTimeSec: 0,
      // Diisi per run oleh game.js; bila tidak ada, pakai nilai standar.
      windX: 0,          // m/s dorongan angin (variasi ringan per run)
      windZ: 0,
      fuelScale: 1,      // 0.7 di mode Santai
      landSpeedMax: 48   // 55 di mode Santai
    };
  }

  function stepPlane(plane, input, dt) {
    if (plane.crashed || plane.landed) return;

    var P = CFG.plane;

    // Throttle 0..1.
    plane.throttle = R.clamp(
      plane.throttle + input.throttleDelta() * 0.55 * dt, 0, 1
    );

    // Target pitch/roll dari input, lalu bergerak menuju target.
    var targetPitch = input.pitchInput() * P.maxPitchDeg;
    var targetRoll = input.rollInput() * P.maxRollDeg;
    var pitchStep = P.pitchRate * dt;
    var rollStep = P.rollRate * dt;
    plane.pitchDeg += R.clamp(targetPitch - plane.pitchDeg, -pitchStep, pitchStep);
    plane.rollDeg += R.clamp(targetRoll - plane.rollDeg, -rollStep, rollStep);

    // Kecepatan menuju target dari throttle; stall membuat pesawat jatuh.
    var targetSpeed = plane.throttle * P.maxSpeed;
    var speedStep = P.accel * dt;
    if (plane.speed < targetSpeed) {
      plane.speed = Math.min(targetSpeed, plane.speed + speedStep);
    } else {
      plane.speed = Math.max(targetSpeed, plane.speed - speedStep * P.drag * 4);
    }

    // Belok sebanding roll; tetap lincah di kecepatan rendah supaya
    // ring bisa dikejar (radius belok kecil di semua kecepatan).
    // Tanda positif: roll ke kanan (sayap kanan turun) = belok kanan,
    // heading bertambah ke arah timur.
    var speedFactor = 0.35 + 0.65 * (plane.speed / P.maxSpeed);
    var turnDeg = plane.rollDeg * P.turnRate * speedFactor * dt;
    plane.headingDeg = (plane.headingDeg + turnDeg + 360) % 360;

    // Gerak maju + naik/turun.
    var hRad = R.degToRad(plane.headingDeg);
    var pRad = R.degToRad(plane.pitchDeg);
    var forwardX = Math.sin(hRad);
    var forwardZ = -Math.cos(hRad);
    var climb = Math.sin(pRad) * P.climbFactor;
    var horizontal = Math.cos(pRad);

    // Stall: kecepatan rendah -> tidak ada lift, pesawat merosot.
    var lift = R.clamp(plane.speed / P.minFlySpeed, 0, 1);
    var sinkRate = (1 - lift) * 22; // m/s jatuh saat stall
    plane.verticalSpeed = plane.speed * climb - sinkRate;

    plane.x += forwardX * horizontal * plane.speed * dt;
    plane.z += forwardZ * horizontal * plane.speed * dt;
    plane.y += plane.verticalSpeed * dt;

    // Angin: dorongan pelan konstan per run (0 bila tidak diisi).
    if (plane.windX || plane.windZ) {
      plane.x += (plane.windX || 0) * dt;
      plane.z += (plane.windZ || 0) * dt;
    }

    // Batas dunia: pantulkan halus di tepi.
    var edge = CFG.world.size / 2 - 120;
    if (Math.abs(plane.x) > edge || Math.abs(plane.z) > edge) {
      plane.headingDeg = (plane.headingDeg + 180) % 360;
      plane.x = R.clamp(plane.x, -edge, edge);
      plane.z = R.clamp(plane.z, -edge, edge);
    }
    if (plane.y > 650) { plane.y = 650; plane.pitchDeg = Math.min(plane.pitchDeg, 0); }

    // Bahan bakar (diskal oleh fuelScale mode Santai).
    var burn = (P.fuelBurnIdle + (P.fuelBurnPerSec - P.fuelBurnIdle) * plane.throttle) *
      (plane.fuelScale || 1) * dt;
    plane.fuel = Math.max(0, plane.fuel - burn);
    if (plane.fuel <= 0) plane.throttle = 0;

    if (!plane.onGround) plane.airTimeSec += dt;

    // Tanah di bawah pesawat.
    var ground = WORLD.terrainHeight(plane.x, plane.z);
    var clearance = plane.y - ground;

    if (plane.onGround) {
      // Di darat: tetap menggelinding di landasan sampai cukup cepat
      // dan hidung terangkat — tanpa ini pesawat "jatuh" sebelum lepas landas.
      if (plane.speed > P.minFlySpeed && plane.verticalSpeed > 0.5) {
        plane.onGround = false;
      } else {
        plane.y = ground + 1.2;
        plane.verticalSpeed = 0;
        clearance = 1.2;
      }
    }

    if (clearance <= 1.5 && !plane.onGround) {
      var onRwy = WORLD.onRunway(plane.x, plane.z);
      var maxLandSpeed = plane.landSpeedMax || 48;
      var gentle = plane.verticalSpeed > -10 && plane.speed < maxLandSpeed;
      if (plane.verticalSpeed >= 0) {
        // Mendaki menjauhi tanah: bukan tabrakan, jangan biarkan menembus tanah.
        plane.y = ground + 1.5;
      } else if (onRwy && gentle && lift > 0.4) {
        // Mendarat.
        plane.y = ground + 1.2;
        plane.landed = true;
        plane.onGround = true;
        plane.speed = Math.max(0, plane.speed - 30 * dt);
      } else if (plane.speed < 12 && plane.verticalSpeed > -4) {
        // Mendarat darurat di tanah datar (bukan landasan): selamat tapi misi gagal.
        plane.y = ground + 1.2;
        plane.onGround = true;
        plane.speed = 0;
      } else {
        // Tabrakan — catat alasannya agar pemain tahu apa yang salah.
        plane.damage = 100;
        plane.crashed = true;
        plane.y = ground + 1;
        if (onRwy && plane.speed >= maxLandSpeed) {
          plane.crashReason = 'speed';   // terlalu cepat saat touchdown
        } else if (plane.verticalSpeed <= -10) {
          plane.crashReason = 'steep';   // turun terlalu curam
        } else {
          plane.crashReason = 'terrain'; // menabrak bukit/tanah
        }
      }
    } else if (clearance > 1.5) {
      plane.onGround = false;
    }
  }

  // Skor pendaratan: 0..1 dari kecepatan, kelembutan, dan posisi tengah.
  function landingQuality(plane) {
    return landingBreakdown(plane).total;
  }

  // Rincian skor pendaratan (0..1 per komponen) untuk layar akhir.
  function landingBreakdown(plane) {
    var speedOk = R.clamp(1 - Math.abs(plane.speed - 30) / 30, 0, 1);
    var centerOk = R.clamp(1 - WORLD.runwayCenterOffset(plane.x, plane.z) / 21, 0, 1);
    var softOk = R.clamp(1 - Math.abs(plane.verticalSpeed) / 6, 0, 1);
    return {
      speed: speedOk,
      center: centerOk,
      soft: softOk,
      total: speedOk * 0.4 + centerOk * 0.35 + softOk * 0.25
    };
  }

  // Grade pendaratan dari kualitas 0..1.
  function landingGrade(quality) {
    if (quality >= 0.9) return 'S';
    if (quality >= 0.75) return 'A';
    if (quality >= 0.55) return 'B';
    return 'C';
  }

  global.NSC_PHYSICS = {
    createPlane: createPlane,
    stepPlane: stepPlane,
    landingQuality: landingQuality,
    landingBreakdown: landingBreakdown,
    landingGrade: landingGrade
  };
})(typeof window !== 'undefined' ? window : globalThis);
