// Nusantara Sky Courier — main.ts
// Entrypoint (Node 22): menyalin game/ dan screenshots/ ke direktori
// output, lalu menulis dossier.json dengan buildDossier dari
// vendor/makefun-game.ts (salinan kit, tidak diubah).
// Di luar grader, MAKEFUN_OUTPUT_DIR menggantikan /output.
// PENTING: direktori repo diambil dari lokasi file ini sendiri, BUKAN
// process.cwd() — grader menjalankan `node /bot/main.ts` dengan cwd
// yang bukan /bot, dan cwd membuat cpSync gagal (ENOENT) sehingga
// grade run exit 1 (v1 dan v2 sama-sama gagal run_completes karenanya).
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = process.env.MAKEFUN_BOT_DIR || dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('wrote dossier.json (' + dossier.length + ' bytes) to ' + outDir);
