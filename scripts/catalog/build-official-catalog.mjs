#!/usr/bin/env node
/**
 * Fabrique le catalogue livré (`resources/catalog.seed.json`) à partir des données extraites du
 * client du jeu (issue n°8). Rien n'est saisi à la main : chaque position vient des fichiers lus.
 *
 * Source : publication `v6.0_3.7.13.17` de github.com/ledouxm/dofus-sqlite (fichiers JSON par
 * classe de données et `i18n_fr.json`). Fichiers attendus dans <dossier> :
 *   dungeonsdata, hintsdata, mapsinformationdata, subareasdata, areasdata, worldmapsdata,
 *   jobsdata, breedsdata, monstersdata, questobjectivesdata, npcsdata, i18n_fr (.json)
 *
 * Usage : node scripts/catalog/build-official-catalog.mjs <dossier> [sortie-du-manifeste-images]
 *
 * Règle des commandes : la commande du zaap le plus proche (référentiel `resources/zaaps.json`,
 * distance de Manhattan, même monde, ex aequo par nom puis identifiant : la règle de
 * `nearestZaaps`), puis `/travel X Y` vers la cible ; sur le zaap même, la commande du zaap
 * seule (`zaapTripCommand`). `tests/officialCatalog.test.ts` recalcule chaque commande.
 * Une cible dans un autre monde (Srambad, Xélorium…) n'a pas de zaap : `/travel X Y` seul, à
 * taper sur place. Un donjon d'un autre monde dont l'entrée est marquée sur la carte du Monde
 * des Douze devient une carte à deux étapes : l'entrée, puis le donjon dans ce monde.
 *
 * Les images ne sont pas fabriquées ici : le manifeste dit, pour chaque fichier `images/…`,
 * quelle archive `images-*.zip` de la même publication et quel membre convertir
 * (`scripts/catalog/convert-images.py`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');
const DATA_VERSION = 'v6.0_3.7.13.17';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage : node scripts/catalog/build-official-catalog.mjs <dossier des données> [manifeste]');
  process.exit(2);
}
const manifestPath = process.argv[3] ?? join(dir, 'images.manifest.json');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
/** Enregistrements d'un fichier de données (sérialisation Unity : `references.RefIds[].data`). */
const records = (name) => readJson(join(dir, `${name}.json`)).references.RefIds.map((r) => r.data);
const i18n = readJson(join(dir, 'i18n_fr.json'));
const text = (id) => {
  const t = i18n[String(id)];
  if (typeof t !== 'string' || t.trim() === '') throw new Error(`Texte ${id} introuvable`);
  return t.trim();
};
const byId = (list) => new Map(list.map((r) => [r.id, r]));

const fold = (s) =>
  s
    .replaceAll('œ', 'oe')
    .replaceAll('Œ', 'Oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const slug = (s) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// --- Données ---------------------------------------------------------------------------------
const maps = byId(records('mapsinformationdata'));
const subareas = byId(records('subareasdata'));
const areas = byId(records('areasdata'));
const worldmaps = byId(records('worldmapsdata'));
const hints = records('hintsdata');
const HINT = { classes: 1, auction: 2, workshops: 3, misc: 4, dungeons: 6 };

const zaapFile = readJson(join(ROOT, 'resources/zaaps.json'));
const zaaps = zaapFile.zaaps;

/**
 * Mondes du jeu dont les coordonnées sont celles d'un monde du référentiel des zaaps.
 * 10 (Village de la Canopée) et 38 (Village des Brigandins) recouvrent le Monde des Douze : les
 * zaaps de ces villages y figurent, aux mêmes coordonnées.
 */
const ZAAP_WORLD = new Map([
  [1, 'douze'],
  [2, 'incarnam'],
  [10, 'douze'],
  [38, 'douze'],
]);
/** Carte d'intérieur (`worldMap` -1) : ses coordonnées sont celles du lieu sur la carte du monde. */
const INDOOR = -1;

function place(subAreaId) {
  const sub = subareas.get(subAreaId);
  if (!sub) throw new Error(`Sous-zone ${subAreaId} inconnue`);
  const area = areas.get(sub.areaId);
  return { area: area ? text(area.nameId) : '', subarea: text(sub.nameId) };
}

/** Monde des zaaps d'une position d'intérieur : celui de sa zone (Incarnam), sinon les Douze. */
const indoorWorld = (subAreaId) => (place(subAreaId).area === 'Incarnam' ? 'incarnam' : 'douze');

const collator = new Intl.Collator('fr', { sensitivity: 'base' });
function nearestZaap(world, x, y) {
  const list = zaaps
    .filter((z) => z.world === world)
    .map((z) => ({ z, d: Math.abs(z.x - x) + Math.abs(z.y - y) }))
    .sort((a, b) => a.d - b.d || collator.compare(a.z.name, b.z.name) || (a.z.id < b.z.id ? -1 : 1));
  if (list.length === 0) throw new Error(`Aucun zaap dans le monde ${world}`);
  return list[0];
}

/** Commande d'une cible : `zaapTripCommand` (src/features/zaaps/zaaps.ts) sur le zaap le plus proche. */
function trip(world, x, y) {
  const { z, d } = nearestZaap(world, x, y);
  return d === 0 ? z.command : `${z.command};/travel ${x} ${y}`;
}

const images = {};
function image(name, archive, member) {
  const file = `images/${name}.webp`;
  const known = images[file];
  if (known && (known.archive !== archive || known.member !== member)) throw new Error(`Image ${file} en conflit`);
  images[file] = { archive, member };
  return file;
}
const itemImage = (name, iconId) => image(name, 'images-item.zip', `2x/${iconId}.png`);

const destinations = [];
const ids = new Set();
function add(d) {
  if (ids.has(d.id)) throw new Error(`Identifiant en double : ${d.id}`);
  ids.add(d.id);
  destinations.push({ aliases: [], tags: [], enabled: true, sortOrder: 10, ...d });
}
const unique = (list, except = []) => {
  const seen = new Set(except.map(fold));
  return list.filter((s) => s && !seen.has(fold(s)) && seen.add(fold(s)));
};

/** Ville ou région affichée dans le nom : la région pour les capitales, sinon la sous-zone. */
const CITY_AREAS = new Set(['Bonta', 'Brâkmar', 'Astrub', 'Incarnam']);
const label = ({ area, subarea }) => (CITY_AREAS.has(area) ? area : subarea);

/** Position d'un indice de carte, ou `null` s'il est dans un monde sans zaap. */
function hintTarget(h) {
  const world = ZAAP_WORLD.get(h.worldMapId);
  return world ? { world, x: h.x, y: h.y } : null;
}

/**
 * Lieux marqués sur la carte du jeu (une entrée par indice). Plusieurs lieux de même nom au même
 * endroit (même étiquette) sont distingués par leurs coordonnées.
 */
function hintEntries(list, make) {
  const entries = list
    .map((h) => ({ h, where: place(h.subareaId), target: hintTarget(h) }))
    .filter((e) => {
      if (!e.target) skipped.push(`${text(e.h.nameId)} (monde ${e.h.worldMapId}, ${e.h.x},${e.h.y}) : monde sans zaap`);
      return e.target;
    });
  const count = new Map();
  for (const e of entries) {
    const key = `${text(e.h.nameId)}|${label(e.where)}`;
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  for (const e of entries) {
    const shared = count.get(`${text(e.h.nameId)}|${label(e.where)}`) > 1;
    const where = shared ? `${label(e.where)} ${e.h.x},${e.h.y}` : label(e.where);
    add(make(e.h, e.where, where, trip(e.target.world, e.target.x, e.target.y)));
  }
}

const skipped = [];

// --- Donjons ---------------------------------------------------------------------------------
const monsters = byId(
  readJson(join(dir, 'monstersdata.json'))
    .references.RefIds.map((r) => r.data)
    .map(({ id, nameId, gfxId }) => ({ id, nameId, gfxId })),
);
const dungeonHints = new Map(hints.filter((h) => h.categoryId === HINT.dungeons).map((h) => [fold(text(h.nameId)), h]));

for (const d of records('dungeonsdata')) {
  const name = text(d.nameId);
  const entrance = maps.get(d.entranceMapId);
  if (!entrance) throw new Error(`Entrée du donjon ${name} introuvable`);
  if (entrance.worldMap === INDOOR && entrance.posX === 0 && entrance.posY === 0) {
    // Les « Expéditions » : variantes de donjons existants, sans entrée sur une carte.
    skipped.push(`${name} : entrée sans position (0,0)`);
    continue;
  }
  const hint = dungeonHints.get(fold(name));
  const where = place(entrance.subAreaId);
  const bosses = d.bosses.Array.map((id) => monsters.get(id)).filter(Boolean);
  if (bosses.length === 0) {
    // Sans boss ni marque sur la carte : donjon absent du jeu jouable, rien à illustrer.
    skipped.push(`${name} : aucun boss`);
    continue;
  }

  let command;
  let twoStep = null;
  let zone = where.area;
  const world = ZAAP_WORLD.get(entrance.worldMap);
  if (world) {
    command = trip(world, entrance.posX, entrance.posY);
  } else if (entrance.worldMap === INDOOR) {
    const h = hint && hintTarget(hint);
    command = h ? trip(h.world, h.x, h.y) : trip(indoorWorld(entrance.subAreaId), entrance.posX, entrance.posY);
  } else {
    // Donjon dans un autre monde : son entrée sur la carte des Douze, s'il y en a une.
    const inside = `/travel ${entrance.posX} ${entrance.posY}`;
    const h = hint && hintTarget(hint);
    const worldName = text(worldmaps.get(entrance.worldMap).nameId);
    zone = worldName;
    if (h) {
      command = trip(h.world, h.x, h.y);
      twoStep = inside;
    } else {
      command = inside;
    }
  }

  add({
    id: `officiel-donjon-${d.id}`,
    name,
    category: 'dungeon',
    zone,
    aliases: unique(bosses.map((b) => text(b.nameId)), [name]),
    tags: unique([`niveau ${d.optimalPlayerLevel}`, where.subarea, zone === where.area ? '' : where.area]),
    image: image(`donjon-${d.id}`, 'images-monster.zip', `2x/${bosses[0].gfxId}.png`),
    command,
    sortOrder: d.optimalPlayerLevel,
    ...(twoStep ? { twoStep: true, command2: twoStep } : {}),
  });
}

// --- Hôtels de vente -------------------------------------------------------------------------
/** Image par type d'hôtel de vente : l'icône d'un objet qu'on y vend (identifiant d'icône). */
const AUCTION_ICON = {
  ressources: 34009, // Blé
  'équipements': 6007, // Épée de Boisaille
  consommables: 12017, // Potion de Rappel
  runes: 78043, // Rune Fo
  'âmes': 85001, // Pierre d'âme pleine
  'créatures': 97020, // Dragodinde Amande
  'cosmétiques': 164133, // Costume de Guilde
};
hintEntries(
  hints.filter((h) => h.categoryId === HINT.auction),
  (h, where, at, command) => {
    const full = text(h.nameId);
    const kind = full.replace(/^Hôtel de vente des /, '');
    const icon = AUCTION_ICON[kind];
    if (!icon) throw new Error(`Hôtel de vente sans image : ${full}`);
    return {
      id: `officiel-hdv-${h.id}`,
      name: `HDV ${kind} · ${at}`,
      category: 'place',
      zone: where.area,
      aliases: [full],
      tags: unique(['hôtel de vente', where.subarea]),
      image: itemImage(`hdv-${slug(kind)}`, icon),
      command,
    };
  },
);

// --- Ateliers --------------------------------------------------------------------------------
const jobs = records('jobsdata').map((j) => ({ ...j, name: text(j.nameId) }));
/** Ateliers sans métier : l'icône d'un objet qu'on y fabrique. */
const WORKSHOP_ICON = {
  "Atelier d'emballage de cadeaux": 154015, // Emballage surprise
  "Atelier des fées d'artifice": 74030, // Fée d'Artifice Multicolore
};
hintEntries(
  hints.filter((h) => h.categoryId === HINT.workshops),
  (h, where, at, command) => {
    const full = text(h.nameId);
    const plural = full.replace(/^Atelier des /, '');
    const job = jobs.find((j) => fold(`${j.name}s`) === fold(plural));
    let img;
    if (job) img = image(`metier-${slug(job.name)}`, 'images-job.zip', `2x/${job.iconId}.png`);
    else if (WORKSHOP_ICON[full]) img = itemImage(`atelier-${slug(full.replace(/^Atelier (des |d')/, ''))}`, WORKSHOP_ICON[full]);
    else throw new Error(`Atelier sans image : ${full}`);
    return {
      id: `officiel-atelier-${h.id}`,
      // Nom court (la carte n'en montre que deux lignes) : le métier, puis le lieu.
      name: `${job ? job.name : capitalize(full.replace(/^Atelier (des |d')/, ''))} · ${at}`,
      category: 'place',
      zone: where.area,
      aliases: [full],
      tags: unique(['atelier', where.subarea]),
      image: img,
      command,
    };
  },
);

// --- PNJ -------------------------------------------------------------------------------------
// Maîtres de classe : les temples marqués sur la carte.
const breeds = records('breedsdata').map((b) => ({ id: b.id, name: text(b.shortNameId) }));
hintEntries(
  hints.filter((h) => h.categoryId === HINT.classes),
  (h, where, _at, command) => {
    const full = text(h.nameId);
    const breed = breeds.find((b) => fold(full) === fold(`Temple ${b.name}`));
    if (!breed) throw new Error(`Temple sans classe : ${full}`);
    return {
      id: `officiel-temple-${slug(breed.name)}`,
      name: full,
      category: 'npc',
      zone: where.area,
      aliases: [breed.name, 'maître de classe'],
      tags: unique(['temple de classe', where.subarea]),
      image: image(`temple-${slug(breed.name)}`, 'images-class.zip', `godsOmega/LevelUp${breed.id}.png`),
      command,
    };
  },
);

// Banquiers et Almanax : les lieux marqués sur la carte.
const misc = hints.filter((h) => h.categoryId === HINT.misc);
hintEntries(
  misc.filter((h) => text(h.nameId) === 'Banque'),
  (h, where, at, command) => ({
    id: `officiel-banque-${h.id}`,
    name: `Banque · ${at}`,
    category: 'npc',
    zone: where.area,
    aliases: ['banquier'],
    tags: unique(['banque', where.subarea]),
    image: itemImage('banque', 100056), // Sac de Kamas
    command,
  }),
);
hintEntries(
  misc.filter((h) => text(h.nameId) === "Sanctuaire de l'Almanax"),
  (h, where, _at, command) => ({
    id: 'officiel-almanax',
    name: "Sanctuaire de l'Almanax",
    category: 'npc',
    zone: where.area,
    aliases: ['almanax', 'offrande'],
    tags: unique(['almanax', where.subarea]),
    image: itemImage('almanax', 23018), // Dolmanax
    command,
  }),
);

// PNJ nommés : la carte où les objectifs de quête les font rencontrer (la plus citée).
const objectives = records('questobjectivesdata');
const npcNames = new Map(records('npcsdata').map((n) => [n.id, n.nameId]));
const NAMED_NPCS = [
  { npc: 1901, image: ['kerubim-crepin', 157058] }, // figurine Kerubim Crépin
  { npc: 914, image: ['otomai', 23030] }, // Offrande d'Otomaï
];
for (const { npc, image: [file, icon] } of NAMED_NPCS) {
  const count = new Map();
  for (const o of objectives) {
    if (o.parameters.parameter0 !== npc || !o.mapId) continue;
    count.set(o.mapId, (count.get(o.mapId) ?? 0) + 1);
  }
  const best = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  const map = best && maps.get(best[0]);
  if (!map) throw new Error(`Position du PNJ ${npc} introuvable`);
  const world = ZAAP_WORLD.get(map.worldMap) ?? (map.worldMap === INDOOR ? indoorWorld(map.subAreaId) : null);
  if (!world) throw new Error(`PNJ ${npc} hors des mondes des zaaps`);
  const where = place(map.subAreaId);
  const name = text(npcNames.get(npc));
  add({
    id: `officiel-pnj-${npc}`,
    name,
    category: 'npc',
    zone: where.area,
    tags: unique(['pnj', where.subarea]),
    image: itemImage(file, icon),
    command: trip(world, map.posX, map.posY),
  });
}

// --- Écriture --------------------------------------------------------------------------------
const order = { npc: 0, dungeon: 1, place: 2, farm: 3 };
destinations.sort((a, b) => order[a.category] - order[b.category] || a.sortOrder - b.sortOrder || collator.compare(a.name, b.name));

const catalog = { schemaVersion: 3, destinations };
writeFileSync(join(ROOT, 'resources/catalog.seed.json'), `${JSON.stringify(catalog, null, 2)}\n`);
writeFileSync(manifestPath, `${JSON.stringify({ dataVersion: DATA_VERSION, images }, null, 2)}\n`);

const per = {};
for (const d of destinations) per[d.category] = (per[d.category] ?? 0) + 1;
console.log(`catalog.seed.json : ${destinations.length} entrées`, per);
console.log(`images : ${Object.keys(images).length} fichiers (manifeste : ${manifestPath})`);
console.log(`écartés : ${skipped.length}`);
for (const s of skipped) console.log(`  - ${s}`);
