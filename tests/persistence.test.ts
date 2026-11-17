import { describe, expect, it } from 'vitest';
import { parseFavoritesText, parseSettingsText } from '../src/lib/tauri/storage';
import { createWriteGate } from '../src/lib/writeGate';

describe('createWriteGate', () => {
  it('refuse toute écriture avant la fin de la lecture', async () => {
    const gate = createWriteGate('Non chargé');
    let ran = false;
    await expect(
      gate.run(async () => {
        ran = true;
      }),
    ).rejects.toThrow('Non chargé');
    expect(ran).toBe(false);
    expect(gate.writable).toBe(false);
  });

  it('refuse définitivement après une lecture échouée, avec son motif', async () => {
    const gate = createWriteGate('Non chargé');
    gate.refuse('fichier illisible');
    gate.open(); // sans effet : une lecture échouée ne se rattrape pas
    expect(gate.writable).toBe(false);
    await expect(gate.run(async () => 1)).rejects.toThrow('fichier illisible');
  });

  it("exécute les écritures l'une après l'autre, dans l'ordre", async () => {
    const gate = createWriteGate('Non chargé');
    gate.open();
    const order: string[] = [];
    let release!: () => void;
    const first = gate.run(
      () =>
        new Promise<void>((resolve) => {
          order.push('début 1');
          release = () => {
            order.push('fin 1');
            resolve();
          };
        }),
    );
    const second = gate.run(async () => {
      order.push('2');
    });
    await Promise.resolve();
    expect(order).toEqual(['début 1']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['début 1', 'fin 1', '2']);
  });

  it("un échec n'empêche pas les écritures suivantes", async () => {
    const gate = createWriteGate('Non chargé');
    gate.open();
    const failed = gate.run(() => Promise.reject(new Error('disque plein')));
    const next = gate.run(async () => 'ok');
    await expect(failed).rejects.toThrow('disque plein');
    await expect(next).resolves.toBe('ok');
  });
});

describe('parseFavoritesText', () => {
  it('fichier absent : aucun favori, aucune erreur', () => {
    const r = parseFavoritesText(null);
    expect([...r.value]).toEqual([]);
    expect(r.error).toBeNull();
  });

  it('lit les identifiants et ignore les valeurs qui ne sont pas des chaînes', () => {
    const r = parseFavoritesText(JSON.stringify({ ids: ['a', 3, 'b'] }));
    expect([...r.value]).toEqual(['a', 'b']);
    expect(r.error).toBeNull();
  });

  it('JSON invalide ou forme inattendue : erreur (le fichier ne sera pas réécrit)', () => {
    expect(parseFavoritesText('{').error).toMatch(/illisible/);
    expect(parseFavoritesText('[]').error).toMatch(/illisible/);
    expect(parseFavoritesText('{"ids":"a"}').error).toMatch(/illisible/);
  });
});

describe('parseSettingsText', () => {
  it('fichier absent : valeurs par défaut, aucune erreur', () => {
    const r = parseSettingsText(null);
    expect(r.error).toBeNull();
    expect(r.value.updates.mode).toBe('manual');
  });

  it('lit un fichier valide', () => {
    const r = parseSettingsText(JSON.stringify({ alwaysOnTop: false }));
    expect(r.error).toBeNull();
    expect(r.value.alwaysOnTop).toBe(false);
  });

  it('JSON invalide ou racine non objet : erreur, valeurs par défaut', () => {
    expect(parseSettingsText('{').error).toMatch(/illisible/);
    expect(parseSettingsText('[1]').error).toMatch(/illisible/);
    expect(parseSettingsText('[1]').value.updates.mode).toBe('manual');
  });
});
