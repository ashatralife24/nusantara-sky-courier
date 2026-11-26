// Nusantara Sky Courier — world.js
// Dunia: kepulauan tropis dengan satu gunung berapi (Merapi), sawah
// terasering, laut dangkal, dan satu landasan. Semua ketinggian berasal
// dari fungsi deterministik di sini — tidak ada data luar.
(function (global) {
  'use strict';

  var R = global.NSC_RANDOM;
  var CFG = global.NSC_CONFIG;

  // Pulau: pusat, radius, tinggi puncak.
  var ISLANDS = [
    { x: 0, z: 0, r: 1250, peak: 95, name: 'Pulau Merapi' },
    { x: 1450, z: 750, r: 720, peak: 70, name: 'Pulau Kelapa' },
    { x: -1350, z: -750, r: 640, peak: 60, name: 'Pulau Karang' },
    { x: 950, z: -1150, r: 520, peak: 55, name: 'Pulau Pasir' }
  ];

  var VOLCANO = { x: -780, z: -880, r: 520, height: 430 };

  // Ketinggian satu titik dunia. Laut = 0 ke bawah.
  function terrainHeight(x, z) {
    var base = 0;
    // Bukit bergelombang di seluruh peta.
    var hills = R.fbm(x / 620, z / 620, 7, 4);
    base += (hills - 0.45) * 110;

    // Pulau-pulau: masker radial halus.
    for (var i = 0; i < ISLANDS.length; i++) {
      var isl = ISLANDS[i];
      var dx = x - isl.x;
      var dz = z - isl.z;
      var d = Math.sqrt(dx * dx + dz * dz) / isl.r;
      if (d < 1.15) {
        var mask = 1 - R.clamp((d - 0.55) / 0.6, 0, 1);
        mask = mask * mask * (3 - 2 * mask);
        base += mask * isl.peak;
        // Terasering di lereng rendah pulau utama.
        if (i === 0 && d > 0.35 && d < 0.9) {
          var terraces = Math.floor(base / 9) * 9;
          base = base * 0.55 + terraces * 0.45;
        }
      }
    }

    // Gunung Merapi: kerucut curam dengan kawah.
    var vx = x - VOLCANO.x;
    var vz = z - VOLCANO.z;
    var vd = Math.sqrt(vx * vx + vz * vz);
    if (vd < VOLCANO.r) {
      var cone = 1 - vd / VOLCANO.r;
      var crater = vd < 90 ? 0.72 : 1; // kawah cekung di puncak
      base += cone * cone * VOLCANO.height * crater;
    }

    // Landasan: diratakan paksa di sekitar strip (blend lebar agar
    // tidak membentuk tebing curam di sekeliling landasan).
    var rw = CFG.runway;
    var along = -(z - rw.z); // landasan menghadap utara
    var across = x - rw.x;
    if (Math.abs(along) < rw.length / 2 + 170 && Math.abs(across) < rw.width / 2 + 170) {
      var edge = Math.max(
        Math.abs(along) / (rw.length / 2 + 170),
        Math.abs(across) / (rw.width / 2 + 170)
      );
      var flat = 1 - R.clamp((edge - 0.45) / 0.55, 0, 1);
      base = base * (1 - flat) + rw.height * flat;
    }

    return base;
  }

  // Warna terrain dari ketinggian + kemiringan + jarak (kabut nanti di render).
  function terrainColor(x, z, h, slope) {
    var C = CFG.colors;
    if (h < 2) return C.seaShallow;
    if (h < 6) return C.sand;
    if (h < 60) return slope > 0.55 ? C.forest : C.grassLow;
    if (h < 160) return slope > 0.6 ? C.rock : C.grassHigh;
    if (h < 280) return slope > 0.55 ? C.rock : C.forest;
    if (h < 400) return C.rock;
    return C.snow;
  }

  // Apakah titik ini berada di atas permukaan landasan (untuk pendaratan)?
  function onRunway(x, z) {
    var rw = CFG.runway;
    var along = -(z - rw.z);
    var across = x - rw.x;
    return Math.abs(along) < rw.length / 2 && Math.abs(across) < rw.width / 2;
  }

  // Jarak mendatar ke garis tengah landasan (0 = tepat di tengah).
  function runwayCenterOffset(x, z) {
    return Math.abs(x - CFG.runway.x);
  }

  // Cek tabrakan dengan ring: pesawat melewati bidang ring dalam radius.
  // Toleransi +12 m dari jari-jari visual agar ring terasa adil.
  function ringPassed(plane, ring, prevDist) {
    var dx = plane.x - ring.x;
    var dy = plane.y - ring.y;
    var dz = plane.z - ring.z;
    var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return dist < ring.r + 12;
  }

  global.NSC_WORLD = {
    islands: ISLANDS,
    volcano: VOLCANO,
    terrainHeight: terrainHeight,
    terrainColor: terrainColor,
    onRunway: onRunway,
    runwayCenterOffset: runwayCenterOffset,
    ringPassed: ringPassed
  };
})(typeof window !== 'undefined' ? window : globalThis);
