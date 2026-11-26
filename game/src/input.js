// Nusantara Sky Courier — input.js
// Keyboard + mouse. Satu sumber status input; game tidak membaca
// event DOM langsung. Mouse mengendalikan kemudi, roda mouse throttle.
(function (global) {
  'use strict';

  var R = global.NSC_RANDOM;

  function createInput(canvas) {
    var keys = {};
    var mouse = { x: 0.5, y: 0.5, inside: false, down: false };
    var anyKey = false;

    function onKeyDown(e) {
      if (e.repeat) return;
      keys[e.code] = true;
      anyKey = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
    }

    function onKeyUp(e) {
      keys[e.code] = false;
    }

    function onMouseMove(e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = R.clamp((e.clientX - rect.left) / rect.width, 0, 1);
      mouse.y = R.clamp((e.clientY - rect.top) / rect.height, 0, 1);
      mouse.inside = true;
    }

    function onMouseDown() { mouse.down = true; anyKey = true; }
    function onMouseUp() { mouse.down = false; }
    function onMouseLeave() { mouse.inside = false; }

    function onWheel(e) {
      e.preventDefault();
      wheelDelta += (e.deltaY < 0 ? 1 : -1);
    }

    var wheelDelta = 0;

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    function pressed(code) {
      return !!keys[code];
    }

    // Pitch: +1 = naik, -1 = turun. Keyboard menang bila ditekan,
    // kalau tidak mouse mengambil alih (posisi mouse dari tengah).
    function pitchInput() {
      if (pressed('ArrowUp') || pressed('KeyW')) return 1;
      if (pressed('ArrowDown') || pressed('KeyS')) return -1;
      if (mouse.inside) return R.clamp((0.5 - mouse.y) * 2.4, -1, 1);
      return 0;
    }

    // Roll: +1 = belok kanan, -1 = belok kiri.
    function rollInput() {
      if (pressed('ArrowRight') || pressed('KeyD')) return 1;
      if (pressed('ArrowLeft') || pressed('KeyA')) return -1;
      if (mouse.inside) return R.clamp((mouse.x - 0.5) * 2.4, -1, 1);
      return 0;
    }

    // Throttle: Shift naik, Control turun, roda mouse, atau tombol +/-.
    // Mengembalikan delta throttle per frame (dikali dt di physics).
    function throttleDelta() {
      var d = 0;
      if (pressed('ShiftLeft') || pressed('ShiftRight') || pressed('Equal')) d += 1;
      if (pressed('ControlLeft') || pressed('ControlRight') || pressed('Minus')) d -= 1;
      if (mouse.down) d += 0.6; // tahan klik = tambah gas
      if (wheelDelta !== 0) {
        d += wheelDelta * 0.5;
        wheelDelta = 0;
      }
      return d;
    }

    function consumeAnyKey() {
      var v = anyKey;
      anyKey = false;
      return v;
    }

    return {
      pressed: pressed,
      pitchInput: pitchInput,
      rollInput: rollInput,
      throttleDelta: throttleDelta,
      consumeAnyKey: consumeAnyKey,
      mouse: mouse,
      keys: keys
    };
  }

  global.NSC_INPUT = { createInput: createInput };
})(typeof window !== 'undefined' ? window : globalThis);
