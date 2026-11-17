import { useEffect, useRef, useState } from 'react';
import { truncateMiddle } from '../../features/settings/path';
import { copyText } from '../../lib/tauri/clipboard';
import { errorText } from '../../lib/errors';
import { getDataDir, openDataDir } from '../../lib/tauri/dataDir';
import { IS_TAURI } from '../../lib/tauri/env';
import { InstalledOnly, SettingRow } from '../controls';

/** Au-delà, le chemin affiché est raccourci par le milieu (complet en infobulle et à la copie). */
const PATH_MAX_CHARS = 48;
const COPIED_MS = 1500;

/** Identifiant de l'application (`identifier` de `src-tauri/tauri.conf.json`). */
const APP_IDENTIFIER = 'app.maptraveller';

/**
 * Rubrique « Données » : chemin réel du dossier de données (fourni par Rust, jamais écrit ici),
 * ouverture dans l'Explorateur, copie du chemin, contenu du dossier et conseils.
 * Sans props : les réglages en mémoire ne servent pas ici.
 */
export function DataSection() {
  const available = IS_TAURI;
  /** `undefined` : lecture en cours ; `null` : indisponible (navigateur ou erreur). */
  const [dir, setDir] = useState<string | null | undefined>(available ? undefined : null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    getDataDir()
      .then((d) => {
        if (alive) setDir(d);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setDir(null);
        setError(errorText(e));
      });
    return () => {
      alive = false;
    };
  }, [available]);

  const onOpen = async () => {
    setError(null);
    try {
      await openDataDir();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const onCopy = async () => {
    if (!dir) return;
    setError(null);
    try {
      await copyText(dir);
      window.clearTimeout(timer.current);
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
    } catch (e) {
      setError(`Copie impossible : ${errorText(e)}`);
    }
  };

  const ready = available && typeof dir === 'string';

  return (
    <>
      <div className="settings__block">
        <SettingRow
          label="Dossier des données"
          description={
            ready ? (
              <span className="settings__value settings__path" title={dir}>
                {truncateMiddle(dir, PATH_MAX_CHARS)}
              </span>
            ) : available ? (
              dir === undefined ? (
                '…'
              ) : (
                '—'
              )
            ) : (
              <InstalledOnly />
            )
          }
        >
          {/* Toujours présent (vide au repos) pour que le message soit annoncé par les lecteurs d'écran. */}
          <span className="form__hint" role="status">
            {copied ? 'Chemin copié' : ''}
          </span>
          <button type="button" className="btn" disabled={!ready} onClick={() => void onOpen()}>
            Ouvrir
          </button>
          <button type="button" className="btn" disabled={!ready} onClick={() => void onCopy()}>
            Copier le chemin
          </button>
        </SettingRow>
        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="settings__block">
        <h3 className="settings__heading">Contenu</h3>
        <ul className="form__hint settings__list">
          <li>
            <code>catalog.json</code> : vos destinations (le catalogue)
          </li>
          <li>
            <code>favorites.json</code> : vos favoris
          </li>
          <li>
            <code>settings.json</code> : vos réglages
          </li>
          <li>
            <code>aliases.json</code> : vos alias de recherche (créé à la première personnalisation)
          </li>
          <li>
            <code>official.json</code> : les destinations livrées déjà proposées (une destination livrée que
            vous supprimez ne revient pas)
          </li>
          <li>
            <code>images</code> : les images importées
          </li>
          <li>
            <code>*.bak</code> : la version précédente de chaque fichier, dont <code>catalog.json.bak</code> pour le
            catalogue
          </li>
        </ul>
      </div>

      <div className="settings__block">
        <h3 className="settings__heading">Sauvegarde</h3>
        <p className="form__hint">Pour sauvegarder vos données, copiez ce dossier.</p>
        <p className="form__hint settings__notice">
          Fermez l'application avant de modifier ces fichiers à la main : sinon, elle les réécrit à la prochaine
          modification.
        </p>
        <p className="form__hint">
          Windows contient aussi deux dossiers techniques nommés <code>{APP_IDENTIFIER}</code>, l'un dans{' '}
          <code>%APPDATA%</code> (position et taille de la fenêtre), l'autre dans <code>%LOCALAPPDATA%</code> (cache de
          l'affichage). Ils ne contiennent aucune de vos données.
        </p>
      </div>
    </>
  );
}
