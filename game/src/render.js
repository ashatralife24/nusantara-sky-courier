// Nusantara Sky Courier — render.js
// Semua gambar: langit, laut, terrain 3D semu, landasan, ring, pesawat,
// HUD, dan panel instrumen. Tidak ada gambar luar — semuanya digambar
// dari kode dengan Canvas 2D.
(function (global) {
  'use strict';

  var R = global.NSC_RANDOM;
  var CFG = global.NSC_CONFIG;
  var WORLD = global.NSC_WORLD;

  function hexRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function parseColor(c) {
    if (c.charAt(0) === '#') return hexRgb(c);
    var m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(c);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
    return [0, 0, 0];
  }

  function mixHex(a, b, t) {
    var ca = parseColor(a);
    var cb = parseColor(b);
    var r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
    var g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
    var bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function shadeHex(hex, f) {
    var c = hexRgb(hex);
    var r = Math.round(R.clamp(c[0] * f, 0, 255));
    var g = Math.round(R.clamp(c[1] * f, 0, 255));
    var b = Math.round(R.clamp(c[2] * f, 0, 255));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function createRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    var CX = W / 2;
    var CY = H * 0.46;

    // Awan latar: posisi tetap di langit (parallax dari heading).
    var clouds = [];
    var rnd = R.mulberry32(20261126);
    for (var i = 0; i < 16; i++) {
      clouds.push({
        u: rnd(), v: 0.14 + rnd() * 0.24, s: 40 + rnd() * 90, speed: 0.2 + rnd() * 0.5
      });
    }

    function project(x, y, z, cam) {
      var dx = x - cam.x;
      var dy = y - cam.y;
      var dz = z - cam.z;
      var xc = dx * cam.rx + dz * cam.rz;
      var yc = dy;
      var zc = dx * cam.fx + dz * cam.fz;
      var y2 = yc * cam.cosP - zc * cam.sinP;
      var z2 = yc * cam.sinP + zc * cam.cosP;
      if (z2 < 3) return null;
      var focal = CFG.camera.focal;
      return {
        x: CX + (xc / z2) * focal,
        y: CY - (y2 / z2) * focal,
        d: z2,
        s: focal / z2
      };
    }

    function cameraFor(plane) {
      var hRad = R.degToRad(plane.headingDeg);
      var fx = Math.sin(hRad);
      var fz = -Math.cos(hRad);
      var rx = Math.cos(hRad);
      var rz = Math.sin(hRad);
      var pitchCam = R.degToRad(plane.pitchDeg * 0.55);
      return {
        x: plane.x - fx * CFG.camera.backDist,
        y: plane.y + CFG.camera.upDist,
        z: plane.z - fz * CFG.camera.backDist,
        fx: fx, fz: fz, rx: rx, rz: rz,
        cosP: Math.cos(pitchCam), sinP: Math.sin(pitchCam)
      };
    }

    function drawSky(plane, timeSec) {
      var g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
      g.addColorStop(0, CFG.colors.skyTop);
      g.addColorStop(0.55, CFG.colors.skyMid);
      g.addColorStop(1, CFG.colors.skyHorizon);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Matahari: posisi mengikuti heading supaya terasa 3D.
      var sunU = ((R.wrapAngleDeg(215 - plane.headingDeg) + 180) % 360) / 360;
      var sunX = sunU * W * 1.4 - W * 0.2;
      var sunY = H * 0.2;
      var sg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
      sg.addColorStop(0, 'rgba(255,243,196,0.95)');
      sg.addColorStop(0.25, 'rgba(255,230,150,0.55)');
      sg.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(sunX - 100, sunY - 100, 200, 200);

      // Awan parallax.
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (var i = 0; i < clouds.length; i++) {
        var c = clouds[i];
        var cu = (c.u - plane.headingDeg / 360 - timeSec * 0.0004 * c.speed) % 1;
        if (cu < 0) cu += 1;
        var cx = cu * (W + 300) - 150;
        var cy = c.v * H;
        ctx.beginPath();
        ctx.ellipse(cx, cy, c.s, c.s * 0.32, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + c.s * 0.5, cy + 4, c.s * 0.6, c.s * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawTerrain(plane, cam) {
      // Laut dasar di bawah horizon.
      ctx.fillStyle = CFG.colors.seaDeep;
      ctx.fillRect(0, CY, W, H - CY);

      var step = CFG.world.gridStep;
      var radius = CFG.world.gridRadius;
      var half = Math.floor(radius / step);
      var baseX = Math.floor(cam.x / step) * step;
      var baseZ = Math.floor(cam.z / step) * step;
      var cells = [];

      for (var ix = -half; ix < half; ix++) {
        for (var iz = -half; iz < half; iz++) {
          var x0 = baseX + ix * step;
          var z0 = baseZ + iz * step;
          var dx = x0 + step / 2 - cam.x;
          var dz = z0 + step / 2 - cam.z;
          var d2 = dx * dx + dz * dz;
          if (d2 > radius * radius) continue;
          cells.push({ x0: x0, z0: z0, d2: d2 });
        }
      }
      cells.sort(function (a, b) { return b.d2 - a.d2; });

      var fogNear = CFG.world.fogNear;
      var fogFar = CFG.world.fogFar;
      for (var ci = 0; ci < cells.length; ci++) {
        var cell = cells[ci];
        var x0 = cell.x0;
        var z0 = cell.z0;
        var h00 = WORLD.terrainHeight(x0, z0);
        var h10 = WORLD.terrainHeight(x0 + step, z0);
        var h01 = WORLD.terrainHeight(x0, z0 + step);
        var h11 = WORLD.terrainHeight(x0 + step, z0 + step);
        var p00 = project(x0, h00, z0, cam);
        var p10 = project(x0 + step, h10, z0, cam);
        var p01 = project(x0, h01, z0 + step, cam);
        var p11 = project(x0 + step, h11, z0 + step, cam);
        if (!p00 || !p10 || !p01 || !p11) continue;
        var hm = (h00 + h10 + h01 + h11) / 4;
        var slope = Math.abs(h10 - h00) / step + Math.abs(h01 - h00) / step;
        var base = WORLD.terrainColor(x0 + step / 2, z0 + step / 2, hm, slope);
        // Bayangan matahari: lereng menghadap matahari lebih terang.
        var shade = 1 - R.clamp((h10 - h00) * 0.012 + (h01 - h00) * 0.008, -0.25, 0.25);
        var col = shadeHex(base, shade);
        var dist = Math.sqrt(cell.d2);
        if (dist > fogNear) {
          var f = R.clamp((dist - fogNear) / (fogFar - fogNear), 0, 0.85);
          col = mixHex(col, CFG.colors.skyHorizon, f);
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(p00.x, p00.y);
        ctx.lineTo(p10.x, p10.y);
        ctx.lineTo(p11.x, p11.y);
        ctx.lineTo(p01.x, p01.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawRunway(plane, cam) {
      var rw = CFG.runway;
      var hw = rw.width / 2;
      var hl = rw.length / 2;
      var corners = [
        project(rw.x - hw, rw.height, rw.z - hl, cam),
        project(rw.x + hw, rw.height, rw.z - hl, cam),
        project(rw.x + hw, rw.height, rw.z + hl, cam),
        project(rw.x - hw, rw.height, rw.z + hl, cam)
      ];
      if (!corners[0] || !corners[1] || !corners[2] || !corners[3]) return;
      ctx.fillStyle = CFG.colors.runway;
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (var i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.fill();
      // Garis tengah putus-putus.
      ctx.strokeStyle = CFG.colors.runwayLine;
      ctx.lineWidth = 2;
      for (var s = -hl + 30; s < hl - 10; s += 40) {
        var a = project(rw.x, rw.height + 0.4, rw.z + s, cam);
        var b = project(rw.x, rw.height + 0.4, rw.z + s + 22, cam);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // Lampu tepi landasan.
      ctx.fillStyle = '#ffe9a8';
      for (var l = -hl; l <= hl; l += 60) {
        var lp = project(rw.x - hw, rw.height + 1, rw.z + l, cam);
        var rp = project(rw.x + hw, rw.height + 1, rw.z + l, cam);
        if (lp) { ctx.beginPath(); ctx.arc(lp.x, lp.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
        if (rp) { ctx.beginPath(); ctx.arc(rp.x, rp.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      }
    }

    function drawRings(plane, cam, rings, ringIndex) {
      for (var i = ringIndex; i < rings.length; i++) {
        var ring = rings[i];
        var p = project(ring.x, ring.y, ring.z, cam);
        if (!p) continue;
        var rad = Math.max(4, ring.r * p.s * 0.9);
        var isNext = i === ringIndex;
        ctx.save();
        ctx.globalAlpha = isNext ? 1 : 0.45;
        ctx.strokeStyle = isNext ? CFG.colors.ring : '#9fb4c8';
        ctx.lineWidth = isNext ? 6 : 3;
        ctx.shadowColor = CFG.colors.ringGlow;
        ctx.shadowBlur = isNext ? 18 : 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = isNext ? '#fff' : '#dfe9f2';
        ctx.font = 'bold ' + Math.max(12, Math.round(rad * 0.55)) + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ring.label, p.x, p.y);
        ctx.restore();
      }
    }

    function drawPlaneShadow(plane, cam) {
      var ground = WORLD.terrainHeight(plane.x, plane.z);
      var p = project(plane.x, ground + 1, plane.z, cam);
      if (!p) return;
      var alt = Math.max(0, plane.y - ground);
      var a = R.clamp(0.35 - alt / 900, 0.04, 0.35);
      var rx = Math.max(6, 46 * p.s / 14);
      ctx.fillStyle = 'rgba(10,20,30,' + a.toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, rx, rx * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawPlane(plane, timeSec) {
      var px = CX;
      var py = H * 0.52;
      var roll = R.degToRad(plane.rollDeg);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(roll * 0.9);
      var bob = Math.sin(timeSec * 2.2) * 2;
      ctx.translate(0, bob);
      // Bayangan badan.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(4, 10, 92, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      // Sayap utama.
      ctx.fillStyle = '#e8eef4';
      ctx.strokeStyle = '#5a6b7d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-118, 6); ctx.lineTo(-96, -8); ctx.lineTo(96, -8); ctx.lineTo(118, 6);
      ctx.lineTo(96, 12); ctx.lineTo(-96, 12); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Ujung sayap: lampu navigasi.
      var blink = (timeSec % 1) < 0.5;
      ctx.fillStyle = '#ff4040';
      ctx.beginPath(); ctx.arc(-114, 2, blink ? 5 : 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#37e05a';
      ctx.beginPath(); ctx.arc(114, 2, blink ? 5 : 3, 0, Math.PI * 2); ctx.fill();
      // Badan (fuselage) mengarah ke depan / atas layar.
      var bodyGrad = ctx.createLinearGradient(0, 34, 0, -78);
      bodyGrad.addColorStop(0, '#c8d4de');
      bodyGrad.addColorStop(0.5, '#f4f8fb');
      bodyGrad.addColorStop(1, '#9fb2c2');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(-16, 34);
      ctx.quadraticCurveTo(-20, -30, -7, -76);
      ctx.quadraticCurveTo(0, -84, 7, -76);
      ctx.quadraticCurveTo(20, -30, 16, 34);
      ctx.quadraticCurveTo(0, 42, -16, 34);
      ctx.fill();
      ctx.strokeStyle = '#5a6b7d';
      ctx.stroke();
      // Garis oranye khas kurir nusantara di badan.
      ctx.strokeStyle = '#ff7a1a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-14, 10); ctx.lineTo(-8, -58);
      ctx.moveTo(14, 10); ctx.lineTo(8, -58);
      ctx.stroke();
      // Kanopi kokpit (kaca menyala).
      ctx.fillStyle = '#7fd4ff';
      ctx.beginPath();
      ctx.ellipse(0, -52, 9, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(-3, -58, 3, 7, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Stabilizer ekor.
      ctx.fillStyle = '#dfe8ef';
      ctx.strokeStyle = '#5a6b7d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-42, 26); ctx.lineTo(-30, 14); ctx.lineTo(30, 14); ctx.lineTo(42, 26);
      ctx.lineTo(28, 32); ctx.lineTo(-28, 32); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Sirip vertikal.
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.moveTo(-7, 30); ctx.lineTo(-4, 2); ctx.lineTo(4, 2); ctx.lineTo(7, 30); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawHudTop(state) {
      var plane = state.plane;
      ctx.textBaseline = 'alphabetic';
      // Panel atas tembus pandang.
      ctx.fillStyle = 'rgba(8,14,22,0.88)';
      ctx.fillRect(0, 0, W, 64);
      ctx.fillStyle = CFG.colors.hudCyan;
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'left';
      var knots = Math.round(plane.speed * 1.944);
      ctx.fillText(knots + ' kt', 22, 42);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#bfefff';
      ctx.fillText('SPEED', 24, 58);
      ctx.textAlign = 'right';
      ctx.fillStyle = CFG.colors.hudCyan;
      ctx.font = 'bold 30px sans-serif';
      var feet = Math.round(plane.y * 3.281);
      ctx.fillText(feet + ' ft', W - 22, 42);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#bfefff';
      ctx.fillText('ALTITUDE', W - 24, 58);
      // Kompas tengah.
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      var hdg = Math.round(plane.headingDeg) % 360;
      ctx.fillText(('00' + hdg).slice(-3) + '°', CX, 36);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#bfefff';
      ctx.fillText('HEADING', CX, 54);
      // Misi + skor (dengan latar gelap tipis agar terbaca di atas awan).
      ctx.fillStyle = 'rgba(8,14,22,0.8)';
      ctx.fillRect(0, 74, W, 44);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      var ringText = state.ringIndex < CFG.rings.length
        ? 'RING ' + (state.ringIndex + 1) + '/' + CFG.rings.length
        : 'SEMUA RING LEWAT — MENDARAT!';
      ctx.fillText(ringText, 22, 92);
      ctx.textAlign = 'right';
      ctx.fillText('SCORE ' + state.score, W - 22, 92);
      ctx.fillText('TIME ' + Math.max(0, Math.ceil(state.timeLeft)) + 's', W - 22, 112);
      // Panah ke ring berikutnya.
      if (state.ringIndex < CFG.rings.length && !state.plane.crashed && !state.plane.landed) {
        var ring = CFG.rings[state.ringIndex];
        var dx = ring.x - plane.x;
        var dz = ring.z - plane.z;
        var bearing = R.radToDeg(Math.atan2(dx, -dz));
        var rel = R.wrapAngleDeg(bearing - plane.headingDeg);
        var dist = Math.round(Math.sqrt(dx * dx + dz * dz));
        ctx.textAlign = 'center';
        ctx.fillStyle = CFG.colors.hudAmber;
        ctx.font = 'bold 16px sans-serif';
        var arrow = rel > 25 ? '▶ BELOK KANAN' : rel < -25 ? '◀ BELOK KIRI' : '▲ LURUS';
        ctx.fillText(arrow + '  •  ' + dist + ' m', CX, 92);
      }
    }

    function drawInstruments(state) {
      var plane = state.plane;
      var panelY = H - 128;
      ctx.fillStyle = CFG.colors.panel;
      ctx.fillRect(0, panelY, W, 128);
      ctx.fillStyle = CFG.colors.panelEdge;
      ctx.fillRect(0, panelY, W, 3);

      // 1) Artificial horizon.
      var hx = 150;
      var hy = panelY + 64;
      var hr = 48;
      ctx.save();
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.clip();
      ctx.translate(hx, hy);
      ctx.rotate(-R.degToRad(plane.rollDeg));
      var pitchPx = R.clamp(plane.pitchDeg, -30, 30) * 1.6;
      ctx.fillStyle = '#3f8fd2';
      ctx.fillRect(-hr - 4, -hr - 4 - pitchPx, hr * 2 + 8, hr + 4 + pitchPx);
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(-hr - 4, pitchPx, hr * 2 + 8, hr + 4 - pitchPx + 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-hr, pitchPx - 1, hr * 2, 2);
      ctx.restore();
      ctx.strokeStyle = CFG.colors.hudAmber;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = CFG.colors.hudAmber;
      ctx.beginPath();
      ctx.moveTo(hx - 18, hy); ctx.lineTo(hx - 4, hy); ctx.lineTo(hx, hy - 5);
      ctx.lineTo(hx + 4, hy); ctx.lineTo(hx + 18, hy); ctx.stroke();
      ctx.fillStyle = '#bfefff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ATTITUDE', hx, panelY + 122);

      // 2) Throttle + fuel.
      var tx = 330;
      ctx.fillStyle = '#0a0f16';
      ctx.fillRect(tx, panelY + 14, 26, 88);
      var thH = 88 * plane.throttle;
      ctx.fillStyle = plane.throttle > 0.85 ? CFG.colors.hudAmber : CFG.colors.hudGreen;
      ctx.fillRect(tx + 2, panelY + 100 - thH, 22, thH);
      ctx.fillStyle = '#bfefff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('THR', tx + 13, panelY + 122);
      ctx.textAlign = 'left';
      ctx.fillText(Math.round(plane.throttle * 100) + '%', tx + 34, panelY + 34);
      // Fuel bar.
      ctx.fillStyle = '#0a0f16';
      ctx.fillRect(tx + 34, panelY + 46, 130, 16);
      ctx.fillStyle = plane.fuel < 20 ? CFG.colors.hudRed : CFG.colors.hudAmber;
      ctx.fillRect(tx + 36, panelY + 48, 126 * (plane.fuel / 100), 12);
      ctx.fillStyle = '#bfefff';
      ctx.font = '12px sans-serif';
      ctx.fillText('FUEL ' + Math.round(plane.fuel) + '%', tx + 34, panelY + 82);
      ctx.fillText('V/S ' + (plane.verticalSpeed >= 0 ? '+' : '') + plane.verticalSpeed.toFixed(1) + ' m/s', tx + 34, panelY + 102);

      // 3) Pita kompas + info landasan (tengah).
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(CFG.runway.name, CX, panelY + 30);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#bfefff';
      var ground = WORLD.terrainHeight(plane.x, plane.z);
      var clearance = Math.max(0, plane.y - ground);
      ctx.fillText('AGL ' + Math.round(clearance) + ' m   •   ' +
        (WORLD.onRunway(plane.x, plane.z) ? 'DI ATAS LANDASAN' : 'TERRAIN ' + Math.round(ground) + ' m'),
        CX, panelY + 54);
      // Strip kompas.
      ctx.fillStyle = '#0a0f16';
      ctx.fillRect(CX - 180, panelY + 66, 360, 26);
      ctx.fillStyle = CFG.colors.hudCyan;
      ctx.font = '13px sans-serif';
      for (var d = -90; d <= 90; d += 30) {
        var deg = (Math.round(plane.headingDeg) + d + 360) % 360;
        var lx = CX + d * 2;
        ctx.fillText(('00' + deg).slice(-3), lx, panelY + 84);
      }
      ctx.fillStyle = CFG.colors.hudAmber;
      ctx.beginPath();
      ctx.moveTo(CX - 6, panelY + 66); ctx.lineTo(CX + 6, panelY + 66); ctx.lineTo(CX, panelY + 76);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#bfefff';
      ctx.font = '11px sans-serif';
      ctx.fillText('KEYBOARD + MOUSE  •  W/S PITCH  •  A/D ROLL  •  SHIFT THROTTLE', CX, panelY + 112);

      // 4) Status kanan: kerusakan + pesan.
      ctx.textAlign = 'right';
      ctx.fillStyle = plane.damage > 0 ? CFG.colors.hudRed : CFG.colors.hudGreen;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(plane.crashed ? 'CRASHED' : plane.landed ? 'LANDED' : 'AIRBORNE', W - 24, panelY + 30);
      ctx.fillStyle = '#bfefff';
      ctx.font = '12px sans-serif';
      ctx.fillText('DAMAGE ' + Math.round(plane.damage) + '%', W - 24, panelY + 52);
      ctx.fillText('AIR TIME ' + Math.round(plane.airTimeSec) + 's', W - 24, panelY + 72);
    }

    function drawWarnings(state, timeSec) {
      var plane = state.plane;
      var msgs = [];
      if (plane.speed < CFG.plane.minFlySpeed && !plane.onGround && !plane.crashed) {
        msgs.push({ text: 'STALL! TAMBAH GAS', color: CFG.colors.hudRed });
      }
      if (plane.fuel < 20 && plane.fuel > 0) {
        msgs.push({ text: 'FUEL LOW', color: CFG.colors.hudAmber });
      }
      var ground = WORLD.terrainHeight(plane.x, plane.z);
      if (plane.y - ground < 45 && plane.verticalSpeed < -4 && !plane.crashed && !plane.landed) {
        msgs.push({ text: 'PULL UP!', color: CFG.colors.hudRed });
      }
      if (!msgs.length) return;
      var blink = (timeSec % 0.8) < 0.45;
      if (!blink) return;
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px sans-serif';
      for (var i = 0; i < msgs.length; i++) {
        ctx.fillStyle = msgs[i].color;
        ctx.fillText(msgs[i].text, CX, 150 + i * 32);
      }
    }

    function drawOverlay(state) {
      if (state.status === 'flying') return;
      ctx.fillStyle = 'rgba(6,10,18,0.62)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      if (state.status === 'title') {
        ctx.font = 'bold 54px sans-serif';
        ctx.fillStyle = CFG.colors.hudAmber;
        ctx.fillText(CFG.gameTitle, CX, H * 0.3);
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#eaf6ff';
        ctx.fillText(CFG.gameSubtitle, CX, H * 0.3 + 34);
        ctx.font = '15px sans-serif';
        ctx.fillStyle = '#bfefff';
        ctx.fillText('Misi: lewati 6 ring kuning, lalu mendarat di RWY 36 Pulau Merapi.', CX, H * 0.42);
        ctx.fillText('W / ↑ naik  •  S / ↓ turun  •  A / D belok  •  SHIFT gas  •  Mouse juga bisa mengemudi', CX, H * 0.42 + 26);
        ctx.fillText('Hemat bahan bakar — setiap ring memberi +12% fuel dan 250 poin.', CX, H * 0.42 + 52);
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#fff';
        var pulse = 0.6 + 0.4 * Math.sin(state.timeSec * 3);
        ctx.globalAlpha = pulse;
        ctx.fillText('TEKAN ENTER ATAU KLIK UNTUK TERBANG', CX, H * 0.56);
        ctx.globalAlpha = 1;
      } else if (state.status === 'crashed') {
        ctx.font = 'bold 48px sans-serif';
        ctx.fillStyle = CFG.colors.hudRed;
        ctx.fillText('PESAWAT JATUH', CX, H * 0.38);
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('Skor ' + state.score + '  •  Ring ' + state.ringIndex + '/' + CFG.rings.length, CX, H * 0.38 + 36);
        ctx.fillText('Tekan R untuk terbang lagi', CX, H * 0.38 + 66);
      } else if (state.status === 'landed' || state.status === 'complete') {
        ctx.font = 'bold 48px sans-serif';
        ctx.fillStyle = CFG.colors.hudGreen;
        ctx.fillText(state.status === 'complete' ? 'MISI SELESAI!' : 'BERHASIL MENDARAT!', CX, H * 0.38);
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('Skor ' + state.score + '  •  Kualitas mendarat ' +
          Math.round(state.landingQuality * 100) + '%', CX, H * 0.38 + 36);
        ctx.fillText('Tekan R untuk terbang lagi', CX, H * 0.38 + 66);
      }
    }

    function render(state) {
      var plane = state.plane;
      var cam = cameraFor(plane);
      drawSky(plane, state.timeSec);
      drawTerrain(plane, cam);
      drawRunway(plane, cam);
      drawRings(plane, cam, CFG.rings, state.ringIndex);
      drawPlaneShadow(plane, cam);
      drawPlane(plane, state.timeSec);
      drawHudTop(state);
      drawInstruments(state);
      drawWarnings(state, state.timeSec);
      drawOverlay(state);
    }

    return { render: render };
  }

  global.NSC_RENDER = { createRenderer: createRenderer };
})(typeof window !== 'undefined' ? window : globalThis);
