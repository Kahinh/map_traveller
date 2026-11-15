import { afterEach, describe, expect, it } from 'vitest';
import {
  buildLatestJson,
  checkLatestJson,
  findInstaller,
  installerFileName,
  parsePublicKey,
  PLATFORM,
  prepareRelease,
  readAppConfig,
  releaseDownloadUrl,
  rfc3339,
  verifyPublishedRelease,
  verifySignature,
  versionFromTag,
  type LatestJson,
} from '../scripts/make-latest-json.mjs';
import {
  joinPath,
  listDir,
  makeKeyPair,
  makeRelease,
  makeSignature,
  readText,
  removeDir,
  REPO_ROOT,
  writeText,
  type FakeRelease,
} from './fixtures/releaseFixture.mjs';

// Tous les dépôts de test sont temporaires ; clés jetables, installateurs factices.
const created: FakeRelease[] = [];
function release(options?: Parameters<typeof makeRelease>[0]): FakeRelease {
  const r = makeRelease(options);
  created.push(r);
  return r;
}
afterEach(() => {
  for (const r of created.splice(0)) removeDir(r.root);
});

const NOW = new Date('2026-01-02T03:04:05.678Z');

function prepare(r: FakeRelease, tag = 'v9.1.0') {
  return prepareRelease({ rootDir: r.root, tag, bundleDir: r.bundleDir, outDir: r.outDir, now: NOW });
}

describe('noms et adresses', () => {
  it('installateur NSIS et adresse du tag EXACT, encodée', () => {
    expect(installerFileName('MapTraveller', '9.1.0')).toBe('MapTraveller_9.1.0_x64-setup.exe');
    expect(releaseDownloadUrl('Kahinh/map_traveller', 'v9.1.0', 'MapTraveller_9.1.0_x64-setup.exe')).toBe(
      'https://github.com/Kahinh/map_traveller/releases/download/v9.1.0/MapTraveller_9.1.0_x64-setup.exe',
    );
    expect(releaseDownloadUrl('o/r', 'v1.0.0', 'Map Traveller.exe')).toBe('https://github.com/o/r/releases/download/v1.0.0/Map%20Traveller.exe');
    expect(releaseDownloadUrl('o/r', 'v1.0.0', 'x.exe')).not.toContain('latest');
  });

  it('tag vX.Y.Z obligatoire', () => {
    expect(versionFromTag('v9.1.0')).toBe('9.1.0');
    for (const bad of ['9.1.0', 'v9.1', 'v9.1.0-beta', '', 'vX.Y.Z']) expect(() => versionFromTag(bad)).toThrow(/Tag invalide/);
  });

  it('date RFC 3339 sans millisecondes', () => {
    expect(rfc3339(NOW)).toBe('2026-01-02T03:04:05Z');
  });

  it('installateur : version différente signalée clairement', () => {
    expect(findInstaller(['a.txt', 'MapTraveller_9.1.0_x64-setup.exe'], 'MapTraveller', '9.1.0')).toBe('MapTraveller_9.1.0_x64-setup.exe');
    expect(() => findInstaller(['MapTraveller_9.0.9_x64-setup.exe'], 'MapTraveller', '9.1.0')).toThrow(/version différente.*9\.0\.9/);
    expect(() => findInstaller([], 'MapTraveller', '9.1.0')).toThrow(/introuvable/);
  });
});

describe('configuration réelle de l’application', () => {
  it('tauri.conf.json : clé publique minisign lisible, une seule adresse HTTPS vers la dernière Release', () => {
    const config = readAppConfig(REPO_ROOT);
    const key = parsePublicKey(config.pubkey);
    expect(key.keyId).toHaveLength(8);
    expect(key.key).toHaveLength(32);
    expect(config.endpoint).toBe('https://github.com/Kahinh/map_traveller/releases/latest/download/latest.json');
    expect(config.productName).toBe('MapTraveller');
  });
});

describe('verifySignature', () => {
  it('accepte une signature valide et renvoie le commentaire de confiance', () => {
    const keys = makeKeyPair();
    const data = new TextEncoder().encode('contenu factice');
    const sig = makeSignature(keys, data, { file: 'f.exe', version: '9.1.0' });
    expect(verifySignature(data, sig, keys.pubkey)).toMatchObject({ file: 'f.exe', version: '9.1.0' });
  });

  it('refuse un contenu modifié, une autre clé, un texte qui n’est pas une signature', () => {
    const keys = makeKeyPair();
    const data = new TextEncoder().encode('contenu factice');
    const sig = makeSignature(keys, data);
    expect(() => verifySignature(new TextEncoder().encode('autre'), sig, keys.pubkey)).toThrow(/invalide/);
    expect(() => verifySignature(data, sig, makeKeyPair().pubkey)).toThrow(/clé/);
    expect(() => verifySignature(data, 'pas une signature', keys.pubkey)).toThrow(/base64/);
    expect(() => verifySignature(data, '', keys.pubkey)).toThrow(/vide/);
  });
});

describe('prepareRelease', () => {
  it('écrit les trois fichiers et un latest.json conforme', () => {
    const r = release();
    const { latest, warnings } = prepare(r);
    expect(listDir(r.outDir)).toEqual(['MapTraveller_9.1.0_x64-setup.exe', 'MapTraveller_9.1.0_x64-setup.exe.sig', 'latest.json']);
    const written = JSON.parse(readText(joinPath(r.outDir, 'latest.json'))) as LatestJson;
    expect(written).toEqual(latest);
    expect(written).toEqual({
      version: '9.1.0',
      notes: 'Notes de version : https://github.com/Kahinh/map_traveller/releases/tag/v9.1.0',
      pub_date: '2026-01-02T03:04:05Z',
      platforms: {
        'windows-x86_64': {
          signature: r.signature,
          url: 'https://github.com/Kahinh/map_traveller/releases/download/v9.1.0/MapTraveller_9.1.0_x64-setup.exe',
        },
      },
    });
    expect(warnings).toEqual([]);
    expect(readText(joinPath(r.outDir, `${r.installer}.sig`))).toBe(r.signature);
  });

  it('échoue si la signature est absente', () => {
    expect(() => prepare(release({ sig: 'missing' }))).toThrow(/absente/);
  });

  it('échoue si la signature est vide', () => {
    expect(() => prepare(release({ sig: 'empty' }))).toThrow(/vide/);
  });

  it('échoue si la signature vient d’une autre clé que celle de tauri.conf.json', () => {
    expect(() => prepare(release({ sig: 'other-key' }))).toThrow(/TAURI_SIGNING_PRIVATE_KEY/);
  });

  it('échoue si la signature ne correspond pas à l’installateur', () => {
    expect(() => prepare(release({ sig: 'tampered' }))).toThrow(/invalide/);
  });

  it('échoue si la version du nom de fichier ne correspond pas', () => {
    expect(() => prepare(release({ installerVersion: '9.0.9' }))).toThrow(/version différente/);
  });

  it('échoue si le tag ne correspond pas à la version', () => {
    expect(() => prepare(release(), 'v9.1.1')).toThrow(/ne correspond pas/);
  });

  it('échoue si la signature a été faite pour une autre version ou un autre fichier', () => {
    expect(() => prepare(release({ signedVersion: '9.0.0' }))).toThrow(/version 9\.0\.0/);
    expect(() => prepare(release({ signedFile: 'autre.exe' }))).toThrow(/autre\.exe/);
  });

  it('signature sans version : acceptée, avec un avertissement', () => {
    expect(prepare(release({ signedVersion: null })).warnings).toHaveLength(1);
  });

  it('refuse un dossier de sortie non vide', () => {
    const r = release();
    writeText(joinPath(r.outDir, 'ancien.txt'), 'x');
    expect(() => prepare(r)).toThrow(/pas vide/);
  });

  it('rien n’est écrit en cas d’échec', () => {
    const r = release({ sig: 'tampered' });
    expect(() => prepare(r)).toThrow();
    expect(() => listDir(r.outDir)).toThrow();
  });
});

describe('checkLatestJson', () => {
  const url = 'https://github.com/Kahinh/map_traveller/releases/download/v9.1.0/MapTraveller_9.1.0_x64-setup.exe';
  const ok = buildLatestJson({ version: '9.1.0', notes: '', pubDate: 'd', signature: 'SIG', url });

  it('accepte un index conforme', () => {
    expect(checkLatestJson(ok, { version: '9.1.0', url, signature: 'SIG' }, 'test')).toEqual({ signature: 'SIG', url });
  });

  it('refuse version, adresse, plateforme ou signature incorrectes', () => {
    expect(() => checkLatestJson({ ...ok, version: '9.0.0' }, { version: '9.1.0', url }, 't')).toThrow(/version/);
    expect(() => checkLatestJson(ok, { version: '9.1.0', url: `${url}x` }, 't')).toThrow(/adresse/);
    expect(() => checkLatestJson({ ...ok, platforms: {} }, { version: '9.1.0', url }, 't')).toThrow(new RegExp(PLATFORM));
    expect(() => checkLatestJson(ok, { version: '9.1.0', url, signature: 'AUTRE' }, 't')).toThrow(/signature/);
    expect(() => checkLatestJson(null, { version: '9.1.0', url }, 't')).toThrow();
  });
});

describe('verifyPublishedRelease (réseau simulé)', () => {
  function fakeFetch(routes: Record<string, () => Response>) {
    const calls: string[] = [];
    const impl = async (url: string) => {
      calls.push(url);
      const route = routes[url];
      return route ? route() : new Response('introuvable', { status: 404 });
    };
    return { impl, calls };
  }

  function published(r: FakeRelease, latestOverride?: Partial<LatestJson>) {
    const { latest } = prepare(r);
    const entry = latest.platforms[PLATFORM]!;
    const body = JSON.stringify({ ...latest, ...latestOverride });
    return {
      latest,
      routes: {
        'https://github.com/Kahinh/map_traveller/releases/download/v9.1.0/latest.json': () => new Response(body),
        'https://github.com/Kahinh/map_traveller/releases/latest/download/latest.json': () => new Response(body),
        [entry.url]: () => new Response(r.bytes),
      } as Record<string, () => Response>,
    };
  }

  const run = (r: FakeRelease, impl: (url: string) => Promise<Response>, expectedSignature?: string) =>
    verifyPublishedRelease({ rootDir: r.root, tag: 'v9.1.0', fetchImpl: impl, attempts: 1, expectedSignature });

  it('Release correcte : index du tag, index lu par l’application, installateur signé', async () => {
    const r = release();
    const { routes, latest } = published(r);
    const { impl, calls } = fakeFetch(routes);
    await expect(run(r, impl, r.signature)).resolves.toEqual({ version: '9.1.0', url: latest.platforms[PLATFORM]!.url });
    expect(calls).toHaveLength(3);
  });

  it('index de la dernière Release sur une autre version : échec', async () => {
    const r = release();
    const { routes } = published(r);
    routes['https://github.com/Kahinh/map_traveller/releases/latest/download/latest.json'] = () =>
      new Response(JSON.stringify({ version: '9.0.0', platforms: {} }));
    await expect(run(r, fakeFetch(routes).impl)).rejects.toThrow(/version 9\.0\.0/);
  });

  it('installateur qui ne répond pas : échec', async () => {
    const r = release();
    const { routes, latest } = published(r);
    delete routes[latest.platforms[PLATFORM]!.url];
    await expect(run(r, fakeFetch(routes).impl)).rejects.toThrow(/404/);
  });

  it('installateur publié différent de celui signé : échec', async () => {
    const r = release();
    const { routes, latest } = published(r);
    routes[latest.platforms[PLATFORM]!.url] = () => new Response('autre contenu');
    await expect(run(r, fakeFetch(routes).impl)).rejects.toThrow(/invalide/);
  });

  it('latest.json absent de la Release : échec', async () => {
    const r = release();
    await expect(run(r, fakeFetch({}).impl)).rejects.toThrow(/404/);
  });

  it('réessaie avant d’échouer (propagation côté GitHub)', async () => {
    const r = release();
    const { routes } = published(r);
    let n = 0;
    const tagUrl = 'https://github.com/Kahinh/map_traveller/releases/download/v9.1.0/latest.json';
    const original = routes[tagUrl]!;
    routes[tagUrl] = () => (++n < 3 ? new Response('pas encore', { status: 404 }) : original());
    const waits: number[] = [];
    await verifyPublishedRelease({
      rootDir: r.root,
      tag: 'v9.1.0',
      fetchImpl: fakeFetch(routes).impl,
      attempts: 3,
      delayMs: 7,
      wait: async (ms) => {
        waits.push(ms);
      },
    });
    expect(waits).toEqual([7, 7]);
  });
});
