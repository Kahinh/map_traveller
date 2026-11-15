// Fixtures des tests de scripts/make-latest-json.mjs. Pur Node.
//
// Une paire de clés Ed25519 JETABLE est générée à chaque appel, en mémoire : aucune vraie clé,
// aucun secret. Les signatures sont produites au format minisign de Tauri (algorithme « ED » :
// BLAKE2b-512 puis Ed25519, commentaire de confiance signé), comme `tauri signer sign`.
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du dépôt (pour relire la vraie configuration publique de l'application). */
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

const b64 = (data) => Buffer.from(data).toString('base64');

/** Paire de clés jetable au format minisign/Tauri. */
export function makeKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  const keyId = createHash('sha256').update(raw).digest().subarray(0, 8);
  const id = Buffer.from(keyId).reverse().toString('hex').toUpperCase();
  const text = `untrusted comment: minisign public key: ${id}\n${b64(Buffer.concat([Buffer.from('Ed'), keyId, raw]))}\n`;
  return { pubkey: b64(text), privateKey, keyId };
}

/** Contenu d'un fichier .sig de Tauri pour `data`. */
export function makeSignature(keys, data, { file, version } = {}) {
  const fields = [`timestamp:1700000000`];
  if (file !== undefined) fields.push(`file:${file}`);
  if (version !== undefined) fields.push(`version:${version}`);
  const trusted = fields.join('\t');
  const digest = createHash('blake2b512').update(Buffer.from(data)).digest();
  const signature = sign(null, digest, keys.privateKey);
  const global = sign(null, Buffer.concat([signature, Buffer.from(trusted)]), keys.privateKey);
  const text =
    'untrusted comment: signature from tauri secret key\n' +
    `${b64(Buffer.concat([Buffer.from('ED'), keys.keyId, signature]))}\n` +
    `trusted comment: ${trusted}\n${b64(global)}\n`;
  return b64(text);
}

/**
 * Dossier temporaire imitant le dépôt après `tauri build` : src-tauri/tauri.conf.json (clé
 * publique jetable), dossier NSIS avec un installateur FACTICE et, selon `sig`, sa signature.
 */
export function makeRelease({
  version = '9.1.0',
  productName = 'MapTraveller',
  installerVersion = version,
  sig = 'valid',
  signedVersion = version,
  signedFile,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'mt-release-'));
  const keys = makeKeyPair();
  mkdirSync(join(root, 'src-tauri'), { recursive: true });
  const config = {
    productName,
    version,
    plugins: {
      updater: {
        pubkey: keys.pubkey,
        endpoints: ['https://github.com/Kahinh/map_traveller/releases/latest/download/latest.json'],
      },
    },
  };
  writeFileSync(join(root, 'src-tauri', 'tauri.conf.json'), JSON.stringify(config));
  const bundleDir = join(root, 'bundle', 'nsis');
  mkdirSync(bundleDir, { recursive: true });
  const installer = `${productName}_${installerVersion}_x64-setup.exe`;
  const bytes = Buffer.from(`installateur factice ${installerVersion}`);
  writeFileSync(join(bundleDir, installer), bytes);
  let signature = '';
  if (sig !== 'missing') {
    const signer = sig === 'other-key' ? makeKeyPair() : keys;
    const signedBytes = sig === 'tampered' ? Buffer.from('autre contenu') : bytes;
    signature =
      sig === 'empty'
        ? ''
        : makeSignature(signer, signedBytes, {
            file: signedFile ?? installer,
            version: signedVersion === null ? undefined : signedVersion,
          });
    writeFileSync(join(bundleDir, `${installer}.sig`), signature);
  }
  return {
    root,
    bundleDir,
    outDir: join(root, 'release'),
    installer,
    bytes: new Uint8Array(bytes),
    signature,
    pubkey: keys.pubkey,
    keys,
  };
}

export const readText = (path) => readFileSync(path, 'utf8');
export const readBytes = (path) => new Uint8Array(readFileSync(path));
export const listDir = (path) => readdirSync(path).sort();
export const writeText = (path, text) => {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
};
export const removeDir = (path) => rmSync(path, { recursive: true, force: true });
export const joinPath = (...parts) => join(...parts);
