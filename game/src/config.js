// Nusantara Sky Courier — config.js
// Satu tempat untuk semua angka penyeimbang game. Tidak ada file lain
// yang meng-hardcode angka gameplay; semua dibaca dari NSC_CONFIG.
(function (global) {
  'use strict';

  var NSC_CONFIG = {
    gameTitle: 'NUSANTARA SKY COURIER',
    gameSubtitle: 'Antar kargo antar pulau — lewati ring, hemat bahan bakar, mendarat di landasan.',
    version: '1.0.0',

    // Dunia (satuan: meter). x = timur, z = selatan, y = ketinggian.
    world: {
      size: 4200,          // lebar bentang dunia yang digambar
      seaLevel: 0,
      gridStep: 90,        // jarak antar titik terrain
      gridRadius: 1500,    // seberapa jauh terrain digambar dari kamera
      fogNear: 700,        // jarak mulai kabut
      fogFar: 1600,        // jarak kabut penuh
      sunAzimuthDeg: 215,  // arah matahari (untuk bayangan bukit)
      sunElevationDeg: 38
    },

    // Pesawat: performa dan batas.
    plane: {
      maxSpeed: 92,        // m/s pada throttle penuh
      cruiseSpeed: 58,
      minFlySpeed: 24,     // di bawah ini pesawat stall dan jatuh
      accel: 14,           // m/s^2 menuju kecepatan target
      drag: 0.35,
      maxPitchDeg: 24,
      maxRollDeg: 62,
      pitchRate: 42,       // deg per detik menuju target pitch
      rollRate: 95,        // deg per detik menuju target roll
      turnRate: 1.15,      // belok: derajat per derajat roll per detik
      climbFactor: 1.0,
      startFuel: 100,
      fuelBurnPerSec: 0.45, // pada throttle penuh
      fuelBurnIdle: 0.10,
      ringFuelBonus: 12,
      damageOnHardHit: 100,
      damageOnBrush: 22
    },

    // Misi: 6 ring lalu mendarat. Setiap ring: posisi, ketinggian, radius.
    rings: [
      { x: 100,  z: 650,  y: 150, r: 22, label: '1' },
      { x: 620,  z: -260, y: 190, r: 22, label: '2' },
      { x: 1050, z: 420,  y: 230, r: 22, label: '3' },
      { x: 260,  z: 980,  y: 170, r: 22, label: '4' },
      { x: -720, z: 640,  y: 260, r: 24, label: '5' },
      { x: -260, z: -120, y: 210, r: 22, label: '6' }
    ],

    // Landasan utama di pulau tengah.
    runway: {
      x: 0, z: 620,        // titik tengah landasan
      headingDeg: 0,       // menghadap utara (z negatif)
      length: 460,
      width: 42,
      height: 26,          // ketinggian permukaan landasan
      name: 'RWY 36 — PULAU MERAPI'
    },

    // Skor.
    score: {
      ring: 250,
      softLanding: 500,
      perfectLandingBonus: 250, // mendarat pelan di tengah landasan
      timeBonusPerSec: 2,       // sisa waktu dihitung saat misi selesai
      missionTimeLimitSec: 420
    },

    // Kamera chase-view.
    camera: {
      backDist: 15,
      upDist: 4.2,
      lookAhead: 34,
      focal: 760,          // panjang fokus proyeksi (px pada lebar 1280)
      horizonLift: 0.06    // sedikit menaikkan horizon agar panel muat
    },

    // Warna (satu gaya: langit tropis pagi, laut biru, hijau sawah).
    colors: {
      skyTop: '#2f6fd0',
      skyMid: '#7fb2e8',
      skyHorizon: '#cfe8f7',
      sun: '#fff3c4',
      seaDeep: '#0b5fa5',
      seaShallow: '#2fa8c9',
      sand: '#e8d29a',
      grassLow: '#5da244',
      grassHigh: '#3f7d33',
      forest: '#2c5e26',
      rock: '#8a7f72',
      snow: '#f2f5f7',
      terrace: '#7fb84e',
      runway: '#3a3f46',
      runwayLine: '#f5f2e8',
      ring: '#ffb400',
      ringGlow: '#ffdd66',
      hudCyan: '#57e6ff',
      hudAmber: '#ffb400',
      hudGreen: '#7dff8a',
      hudRed: '#ff5d5d',
      panel: '#10151d',
      panelEdge: '#2b3648'
    },

    // Screenshot: ukuran kanvas yang dipakai saat mengambil gambar.
    shot: { width: 1280, height: 800 }
  };

  global.NSC_CONFIG = NSC_CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
