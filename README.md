# Nusantara Sky Courier

An original flight game for the make.fun bounty
[`best-flight-game-20261126-0057`](https://make.fun/bounty/best-flight-game-20261126-0057).

Fly a small courier turboprop across a tropical Indonesian archipelago:
take off from RWY 36 on Pulau Merapi, thread 6 glowing rings over the sea,
rice terraces and the volcano, watch your fuel, then land back on the
runway. Keyboard + mouse, desktop Chrome, static files, no network.

## Play

Open `game/index.html` in desktop Chrome (or serve `game/` with any
static server). `W/S` or `↑/↓` pitch, `A/D` or `←/→` roll, `Shift`
throttle up, `Ctrl` throttle down, mouse steers too, `R` restart, `M` mute.

## Layout

- `game/` — the playable game (static files, no network)
  - `index.html`, `src/config.js`, `src/random.js`, `src/world.js`,
    `src/input.js`, `src/physics.js`, `src/render.js`, `src/audio.js`,
    `src/game.js`, `src/main.js`
- `screenshots/` — 4 real renders of the game (cover first)
- `main.ts` — copies `game/` + `screenshots/` to the output dir and
  writes `dossier.json` via `buildDossier`
- `vendor/makefun-game.ts` — kit copy, unchanged

## License

MIT — see `LICENSE`.
