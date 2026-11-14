// Version unique de l'application, synchronisée dans les 3 fichiers qui la portent :
// package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml.
//
//   node scripts/version.mjs              → affiche la version de chaque fichier
//   node scripts/version.mjs 0.2.0        → écrit 0.2.0 partout
//   node scripts/version.mjs --check 0.2.0 → échoue si un fichier diffère (utilisé par la CI)
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const files = {
  'package.json': {
    read: (s) => JSON.parse(s).version,
    write: (s, v) => s.replace(/("version":\s*")[^"]+(")/, `$1${v}$2`),
  },
  'src-tauri/tauri.conf.json': {
    read: (s) => JSON.parse(s).version,
    write: (s, v) => s.replace(/("version":\s*")[^"]+(")/, `$1${v}$2`),
  },
  'src-tauri/Cargo.toml': {
    // Première clé `version` = celle de [package].
    read: (s) => /^version\s*=\s*"([^"]+)"/m.exec(s)?.[1],
    write: (s, v) => s.replace(/^(version\s*=\s*")[^"]+(")/m, `$1${v}$2`),
  },
};

const load = (f) => readFileSync(new URL(f, root), 'utf8');
const current = () => Object.fromEntries(Object.entries(files).map(([f, h]) => [f, h.read(load(f))]));

const args = process.argv.slice(2);
const SEMVER = /^\d+\.\d+\.\d+$/;

if (args.length === 0) {
  console.table(current());
} else if (args[0] === '--check') {
  const expected = args[1];
  const wrong = Object.entries(current()).filter(([, v]) => v !== expected);
  if (wrong.length) {
    console.error(`Version attendue ${expected}, trouvée :`, Object.fromEntries(wrong));
    console.error('Lancer `npm run version:set -- <version>` puis committer avant de tagger.');
    process.exit(1);
  }
  console.log(`Version ${expected} cohérente dans les 3 fichiers.`);
} else {
  const v = args[0];
  if (!SEMVER.test(v)) {
    console.error(`Version invalide : ${v} (attendu X.Y.Z)`);
    process.exit(1);
  }
  for (const [f, h] of Object.entries(files)) writeFileSync(new URL(f, root), h.write(load(f), v));
  // Garde package-lock.json aligné (racine + paquet "") pour que `npm ci` reste cohérent.
  const lock = JSON.parse(load('package-lock.json'));
  lock.version = v;
  if (lock.packages?.['']) lock.packages[''].version = v;
  writeFileSync(new URL('package-lock.json', root), JSON.stringify(lock, null, 2) + '\n');
  console.log(`Version ${v} écrite dans : ${Object.keys(files).join(', ')}, package-lock.json`);
}
