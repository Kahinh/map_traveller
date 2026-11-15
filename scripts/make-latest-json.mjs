// Fichiers de mise à jour d'une Release (issue n°5). Pur Node, sans dépendance.
//
//   node scripts/make-latest-json.mjs prepare --tag vX.Y.Z [--bundle-dir <dossier>] [--out-dir <dossier>]
//     Avant publication. Lit la version et la clé publique dans src-tauri/tauri.conf.json, trouve
//     l'installateur MapTraveller_X.Y.Z_x64-setup.exe et sa signature .sig dans le dossier NSIS,
//     VÉRIFIE la signature avec la clé publique (comme le fera l'application), puis copie les
//     deux fichiers et écrit latest.json dans le dossier de sortie (par défaut release/).
//     Échoue avec un message clair si un fichier manque, si la signature est vide ou invalide,
//     ou si une version ne correspond pas.
//
//   node scripts/make-latest-json.mjs verify --tag vX.Y.Z [--out-dir <dossier>]
//     Après publication. Relit latest.json depuis la Release du tag ET depuis l'adresse
//     interrogée par l'application, contrôle la version, l'adresse et la signature, télécharge
//     l'installateur publié et vérifie sa signature.
//
// Aucune clé privée n'est lue ni écrite ici : seule la clé publique (non secrète) sert.
import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPOSITORY = 'Kahinh/map_traveller';
export const PLATFORM = 'windows-x86_64';
export const DEFAULT_BUNDLE_DIR = 'src-tauri/target/release/bundle/nsis';
export const DEFAULT_OUT_DIR = 'release';
const SEMVER = /^\d+\.\d+\.\d+$/;

/** Erreur destinée à l'utilisateur du script (message affiché tel quel). */
export class ReleaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReleaseError';
  }
}

const fail = (message) => {
  throw new ReleaseError(message);
};

// ---------------------------------------------------------------------------------------------
// Configuration et noms
// ---------------------------------------------------------------------------------------------

/** Version, nom de produit, clé publique et adresses de l'index, lus dans tauri.conf.json. */
export function readAppConfig(rootDir) {
  const path = join(rootDir, 'src-tauri', 'tauri.conf.json');
  const config = JSON.parse(readFileSync(path, 'utf8'));
  const version = config.version;
  const productName = config.productName;
  const pubkey = config.plugins?.updater?.pubkey;
  const endpoints = config.plugins?.updater?.endpoints;
  if (typeof version !== 'string' || !SEMVER.test(version)) fail(`Version invalide dans ${path} : ${version}`);
  if (typeof productName !== 'string' || productName === '') fail(`productName absent de ${path}.`);
  if (typeof pubkey !== 'string' || pubkey === '') fail(`plugins.updater.pubkey absent de ${path}.`);
  if (!Array.isArray(endpoints) || endpoints.length !== 1 || typeof endpoints[0] !== 'string') {
    fail(`plugins.updater.endpoints doit contenir exactement une adresse dans ${path}.`);
  }
  return { version, productName, pubkey, endpoint: endpoints[0] };
}

/** Version d'un tag `vX.Y.Z`. */
export function versionFromTag(tag) {
  const m = /^v(\d+\.\d+\.\d+)$/.exec(String(tag ?? ''));
  if (!m) fail(`Tag invalide : ${tag} (attendu vX.Y.Z).`);
  return m[1];
}

/** Nom de l'installateur NSIS produit par Tauri. */
export function installerFileName(productName, version) {
  return `${productName}_${version}_x64-setup.exe`;
}

/** Adresse de téléchargement d'un fichier de la Release du tag EXACT (jamais « latest »). */
export function releaseDownloadUrl(repo, tag, fileName) {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(fileName)}`;
}

/** Notes affichées par l'application sous « Version X.Y.Z disponible ». */
export function defaultNotes(repo, tag) {
  return `Notes de version : https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`;
}

/** Date RFC 3339 sans millisecondes (`2026-01-01T00:00:00Z`). */
export function rfc3339(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Contenu de latest.json au format attendu par le plugin de mise à jour. */
export function buildLatestJson({ version, notes, pubDate, signature, url }) {
  return {
    version,
    notes,
    pub_date: pubDate,
    platforms: {
      [PLATFORM]: { signature, url },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Signature minisign (format produit par `tauri build` / `tauri signer sign`)
// ---------------------------------------------------------------------------------------------

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Base64 strict → octets ; `what` nomme la donnée dans le message d'erreur. */
function decodeBase64(text, what) {
  const clean = String(text).trim();
  if (clean === '' || !BASE64.test(clean)) fail(`${what} : base64 invalide.`);
  return Buffer.from(clean, 'base64');
}

/** Clé publique de tauri.conf.json : base64 d'un fichier de clé publique minisign. */
export function parsePublicKey(pubkeyB64) {
  const lines = decodeBase64(pubkeyB64, 'Clé publique').toString('utf8').split(/\r?\n/);
  if (!lines[0]?.startsWith('untrusted comment:')) fail('Clé publique : format minisign inattendu.');
  const raw = decodeBase64(lines[1] ?? '', 'Clé publique (ligne 2)');
  if (raw.length !== 42 || raw.subarray(0, 2).toString('latin1') !== 'Ed') fail('Clé publique : format minisign inattendu.');
  return { keyId: raw.subarray(2, 10), key: raw.subarray(10, 42) };
}

/** Contenu d'un fichier .sig de Tauri : base64 d'une signature minisign (4 lignes). */
export function parseSignature(sigB64) {
  if (String(sigB64 ?? '').trim() === '') fail('Signature vide.');
  const lines = decodeBase64(sigB64, 'Signature').toString('utf8').split(/\r?\n/);
  const [untrusted, sigLine, trustedLine, globalLine] = lines;
  if (!untrusted?.startsWith('untrusted comment:') || !trustedLine?.startsWith('trusted comment: ')) {
    fail('Signature : format minisign inattendu.');
  }
  const raw = decodeBase64(sigLine ?? '', 'Signature (ligne 2)');
  const algorithm = raw.subarray(0, 2).toString('latin1');
  if (raw.length !== 74 || (algorithm !== 'ED' && algorithm !== 'Ed')) fail('Signature : format minisign inattendu.');
  const globalSignature = decodeBase64(globalLine ?? '', 'Signature (signature globale)');
  if (globalSignature.length !== 64) fail('Signature : signature globale de taille inattendue.');
  return {
    algorithm,
    keyId: raw.subarray(2, 10),
    signature: raw.subarray(10, 74),
    trustedComment: trustedLine.slice('trusted comment: '.length),
    globalSignature,
  };
}

/** Champs `clé:valeur` séparés par des tabulations du commentaire de confiance. */
export function trustedCommentFields(trustedComment) {
  const fields = {};
  for (const part of trustedComment.split('\t')) {
    const i = part.indexOf(':');
    if (i > 0) fields[part.slice(0, i)] = part.slice(i + 1);
  }
  return fields;
}

/** Identifiant de clé tel qu'affiché par minisign (hexadécimal, octets inversés). */
const keyIdHex = (keyId) => Buffer.from(keyId).reverse().toString('hex').toUpperCase();

/**
 * Vérifie `data` contre la signature `sigB64` avec la clé publique `pubkeyB64`, comme le plugin
 * (minisign : Ed25519, données pré-hachées BLAKE2b-512 pour l'algorithme « ED », puis signature
 * globale du commentaire de confiance). Lève une `ReleaseError` explicite en cas d'échec.
 * Renvoie les champs du commentaire de confiance.
 */
export function verifySignature(data, sigB64, pubkeyB64) {
  const pub = parsePublicKey(pubkeyB64);
  const sig = parseSignature(sigB64);
  if (!sig.keyId.equals(pub.keyId)) {
    fail(
      `Signature faite avec la clé ${keyIdHex(sig.keyId)}, mais la clé publique de tauri.conf.json est ${keyIdHex(pub.keyId)} : ` +
        "l'application refuserait cette mise à jour. Vérifier le secret TAURI_SIGNING_PRIVATE_KEY.",
    );
  }
  const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: pub.key.toString('base64url') }, format: 'jwk' });
  const message = sig.algorithm === 'ED' ? createHash('blake2b512').update(data).digest() : data;
  if (!cryptoVerify(null, message, key, sig.signature)) fail("Signature invalide : elle ne correspond pas à l'installateur.");
  const global = Buffer.concat([sig.signature, Buffer.from(sig.trustedComment, 'utf8')]);
  if (!cryptoVerify(null, global, key, sig.globalSignature)) fail('Signature invalide : commentaire de confiance altéré.');
  return trustedCommentFields(sig.trustedComment);
}

// ---------------------------------------------------------------------------------------------
// Préparation (avant publication)
// ---------------------------------------------------------------------------------------------

const INSTALLER_PATTERN = /^(.+)_(\d+\.\d+\.\d+)_x64-setup\.exe$/;

/** Nom de l'installateur attendu parmi `files` ; erreur claire s'il manque ou si la version diffère. */
export function findInstaller(files, productName, version) {
  const expected = installerFileName(productName, version);
  if (files.includes(expected)) return expected;
  const others = files.filter((f) => INSTALLER_PATTERN.test(f));
  if (others.length > 0) {
    fail(`Installateur ${expected} introuvable ; version différente dans le dossier : ${others.join(', ')}.`);
  }
  fail(`Installateur ${expected} introuvable.`);
}

/**
 * Prépare les trois fichiers de la Release dans `outDir` : installateur, signature, latest.json.
 * Renvoie le contenu de latest.json et les chemins écrits.
 */
export function prepareRelease({ rootDir, tag, bundleDir, outDir, now = new Date(), repo = REPOSITORY }) {
  const { version, productName, pubkey } = readAppConfig(rootDir);
  const tagVersion = versionFromTag(tag);
  if (tagVersion !== version) fail(`Le tag ${tag} ne correspond pas à la version ${version} de tauri.conf.json.`);

  if (!existsSync(bundleDir)) fail(`Dossier de l'installateur introuvable : ${bundleDir}`);
  const files = readdirSync(bundleDir);
  const installer = findInstaller(files, productName, version);
  const sigName = `${installer}.sig`;
  const installerPath = join(bundleDir, installer);
  const sigPath = join(bundleDir, sigName);
  if (!existsSync(sigPath)) {
    fail(
      `Signature ${sigName} absente : le build doit être lancé avec tauri.release.conf.json ` +
        'et les secrets TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PASSWORD.',
    );
  }
  const signature = readFileSync(sigPath, 'utf8').trim();
  if (signature === '') fail(`Signature ${sigName} vide.`);

  const fields = verifySignature(readFileSync(installerPath), signature, pubkey);
  if (fields.file !== undefined && fields.file !== installer) {
    fail(`La signature porte sur ${fields.file}, pas sur ${installer}.`);
  }
  if (fields.version !== undefined && fields.version !== version) {
    fail(`La signature a été faite pour la version ${fields.version}, pas ${version}.`);
  }
  const warnings = fields.version === undefined ? ['La signature ne porte pas de version (commentaire de confiance sans « version: »).'] : [];

  if (existsSync(outDir) && readdirSync(outDir).length > 0) fail(`Le dossier de sortie ${outDir} n'est pas vide.`);
  mkdirSync(outDir, { recursive: true });
  const latest = buildLatestJson({
    version,
    notes: defaultNotes(repo, tag),
    pubDate: rfc3339(now),
    signature,
    url: releaseDownloadUrl(repo, tag, installer),
  });
  copyFileSync(installerPath, join(outDir, installer));
  copyFileSync(sigPath, join(outDir, sigName));
  const latestPath = join(outDir, 'latest.json');
  writeFileSync(latestPath, `${JSON.stringify(latest, null, 2)}\n`);
  return { latest, installer, files: [join(outDir, installer), join(outDir, sigName), latestPath], warnings };
}

// ---------------------------------------------------------------------------------------------
// Contrôle (après publication)
// ---------------------------------------------------------------------------------------------

/** Vérifie un latest.json publié : version, adresse du tag exact, signature attendue. */
export function checkLatestJson(latest, { version, url, signature }, source) {
  if (typeof latest !== 'object' || latest === null) fail(`${source} : contenu JSON inattendu.`);
  if (latest.version !== version) fail(`${source} : version ${latest.version}, attendu ${version}.`);
  const entry = latest.platforms?.[PLATFORM];
  if (!entry) fail(`${source} : plateforme ${PLATFORM} absente.`);
  if (entry.url !== url) fail(`${source} : adresse ${entry.url}, attendu ${url}.`);
  if (typeof entry.signature !== 'string' || entry.signature.trim() === '') fail(`${source} : signature vide.`);
  if (signature !== undefined && entry.signature !== signature) fail(`${source} : signature différente de celle du build.`);
  return entry;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** `fn` réessayé `attempts` fois, `delayMs` entre deux essais (propagation côté GitHub). */
async function retry(fn, { attempts, delayMs, wait }) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts) {
        console.warn(`Essai ${i}/${attempts} : ${e instanceof Error ? e.message : String(e)}`);
        await wait(delayMs);
      }
    }
  }
  throw last;
}

async function fetchOk(fetchImpl, url) {
  const res = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) });
  if (!res.ok) fail(`${url} : réponse HTTP ${res.status}.`);
  return res;
}

/**
 * Contrôle de la Release publiée. `fetchImpl` et `wait` sont injectables pour les tests.
 * `expectedSignature` (facultatif) : contenu du .sig du build, pour comparaison.
 */
export async function verifyPublishedRelease({
  rootDir,
  tag,
  repo = REPOSITORY,
  expectedSignature,
  fetchImpl = fetch,
  attempts = 6,
  delayMs = 10_000,
  wait = sleep,
}) {
  const { version, productName, pubkey, endpoint } = readAppConfig(rootDir);
  if (versionFromTag(tag) !== version) fail(`Le tag ${tag} ne correspond pas à la version ${version} de tauri.conf.json.`);
  const installer = installerFileName(productName, version);
  const expected = { version, url: releaseDownloadUrl(repo, tag, installer), signature: expectedSignature };
  const options = { attempts, delayMs, wait };

  // 1. latest.json de la Release du tag.
  const tagIndexUrl = releaseDownloadUrl(repo, tag, 'latest.json');
  await retry(async () => checkLatestJson(await (await fetchOk(fetchImpl, tagIndexUrl)).json(), expected, tagIndexUrl), options);

  // 2. latest.json tel que l'application le lit (dernière Release stable).
  const entry = await retry(
    async () => checkLatestJson(await (await fetchOk(fetchImpl, endpoint)).json(), expected, endpoint),
    options,
  );

  // 3. L'installateur répond et sa signature publiée est valide.
  await retry(async () => {
    const bytes = Buffer.from(await (await fetchOk(fetchImpl, entry.url)).arrayBuffer());
    verifySignature(bytes, entry.signature, pubkey);
  }, options);

  return { version, url: entry.url };
}

// ---------------------------------------------------------------------------------------------
// Ligne de commande
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i];
    const value = rest[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail(`Argument inattendu : ${key ?? ''}`);
    options[key.slice(2)] = value;
  }
  return { command, options };
}

export async function main(argv, rootDir = process.cwd()) {
  const { command, options } = parseArgs(argv);
  const outDir = resolve(rootDir, options['out-dir'] ?? DEFAULT_OUT_DIR);
  if (command === 'prepare') {
    const result = prepareRelease({
      rootDir,
      tag: options.tag,
      bundleDir: resolve(rootDir, options['bundle-dir'] ?? DEFAULT_BUNDLE_DIR),
      outDir,
    });
    for (const w of result.warnings) console.warn(`Attention : ${w}`);
    console.log(`latest.json prêt pour la version ${result.latest.version} :`);
    for (const f of result.files) console.log(`  ${f} (${statSync(f).size} octets)`);
    return;
  }
  if (command === 'verify') {
    const sigFile = join(outDir, `${installerFileName(readAppConfig(rootDir).productName, versionFromTag(options.tag))}.sig`);
    const expectedSignature = existsSync(sigFile) ? readFileSync(sigFile, 'utf8').trim() : undefined;
    const { version, url } = await verifyPublishedRelease({ rootDir, tag: options.tag, expectedSignature });
    console.log(`Release ${options.tag} contrôlée : latest.json annonce ${version}, installateur ${url} signé et téléchargeable.`);
    return;
  }
  fail('Commande attendue : prepare ou verify.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof ReleaseError ? `Erreur : ${e.message}` : e);
    process.exit(1);
  });
}
