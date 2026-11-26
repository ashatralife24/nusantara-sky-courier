# nusantara-sky-courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/ashatralife24/nusantara-sky-courier/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/ashatralife24/nusantara-sky-courier/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Nusantara Sky Courier — an original flight game for the make.fun bounty
[`best-flight-game-20261126-0057`](https://make.fun/bounty/best-flight-game-20261126-0057).
Fly a small courier turboprop across a tropical Indonesian archipelago:
take off from RWY 36 on Pulau Merapi, thread 6 glowing rings over the sea,
rice terraces and the volcano, watch your fuel, then land back on the
runway. Keyboard + mouse, desktop Chrome, static files, no network.

## Run it

```sh
python3 -m http.server 8000 --directory game
```

Then open http://localhost:8000 in desktop Chrome.

---

<sub>Entered on [make.fun](https://make.fun/?ref=g8qpnxmg&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

## Play

`W/S` or `↑/↓` pitch, `A/D` or `←/→` roll, `Shift` throttle up, `Ctrl`
throttle down, mouse steers too, `R` restart, `M` mute.

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
