// Nusantara Sky Courier — main.js
// Bootstrap: siapkan kanvas 1280x800, rakit input/audio/render/game,
// baca ?shot=N untuk screenshot, lalu jalankan loop.
(function (global) {
  'use strict';

  function boot() {
    var canvas = document.getElementById('game');
    if (!canvas) return;
    canvas.width = global.NSC_CONFIG.shot.width;
    canvas.height = global.NSC_CONFIG.shot.height;

    var input = global.NSC_INPUT.createInput(canvas);
    var audio = global.NSC_AUDIO.createAudio();
    var renderer = global.NSC_RENDER.createRenderer(canvas);
    var game = global.NSC_GAME.createGame(canvas, renderer, input, audio);

    // Mute dengan tombol M (sekali per tekan).
    var muteArmed = true;
    window.addEventListener('keydown', function (e) {
      if (e.code === 'KeyM' && muteArmed) {
        muteArmed = false;
        audio.toggleMute();
        setTimeout(function () { muteArmed = true; }, 250);
      }
      if (e.code === 'Enter') audio.ensure();
    });
    canvas.addEventListener('mousedown', function () { audio.ensure(); });

    // Mode screenshot: ?shot=1..4 menempatkan pesawat di pose terbaik.
    var params = new URLSearchParams(window.location.search);
    var shot = parseInt(params.get('shot') || '0', 10);
    if (shot >= 1 && shot <= 4) {
      game.applyShotPreset(shot);
    }

    // Render satu frame sinkron agar kanvas sudah berisi gambar bahkan
    // bila screenshot diambil sebelum rAF pertama.
    game.renderOnce();
    game.start();
    global.NSC_GAME_INSTANCE = game;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
