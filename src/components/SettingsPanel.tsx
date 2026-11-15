import { useEffect, useId, useRef, type ComponentType } from 'react';
import type { AliasesBinding } from '../app/useAliases';
import type { Destination } from '../features/catalog/schema';
import type { Settings, SettingsPatch } from '../features/settings/settings';
import { UPDATER_NOT_AVAILABLE, type UpdaterBinding } from '../features/updates/types';
import { Panel } from './Panel';
import { AliasesSection } from './settings/AliasesSection';
import { DataSection } from './settings/DataSection';
import { DisplaySection } from './settings/DisplaySection';
import { ShortcutsSection } from './settings/ShortcutsSection';
import type { SettingsSectionProps } from './settings/types';
import { UpdatesSection } from './settings/UpdatesSection';

interface SectionDef {
  id: string;
  label: string;
  render: ComponentType<SettingsSectionProps>;
}

/**
 * Registre des rubriques : SEULE chose à modifier pour en ajouter une (un fichier par rubrique
 * dans `components/settings/`). L'ordre du tableau est celui des onglets.
 */
export const SETTINGS_SECTIONS = [
  { id: 'updates', label: 'Mises à jour', render: UpdatesSection },
  { id: 'data', label: 'Données', render: DataSection },
  { id: 'display', label: 'Affichage', render: DisplaySection },
  { id: 'aliases', label: 'Alias', render: AliasesSection },
  { id: 'shortcuts', label: 'Raccourcis', render: ShortcutsSection },
] as const satisfies readonly SectionDef[];

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];

export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = SETTINGS_SECTIONS[0].id;

interface Props {
  section: SettingsSectionId;
  settings: Settings;
  /** Moteur de mise à jour, fourni par l'issue n°5 ; indisponible par défaut. */
  updater?: UpdaterBinding;
  aliases: AliasesBinding;
  destinations: readonly Destination[];
  onSectionChange: (section: SettingsSectionId) => void;
  onChange: (patch: SettingsPatch) => void;
  onClose: () => void;
}

/**
 * Panneau Paramètres : rangée d'onglets (une par rubrique) et contenu défilant. Chaque réglage
 * est enregistré dès qu'il change : pas de bouton « Enregistrer ».
 */
export function SettingsPanel({
  section,
  settings,
  updater = UPDATER_NOT_AVAILABLE,
  aliases,
  destinations,
  onSectionChange,
  onChange,
  onClose,
}: Props) {
  const uid = useId();
  const tabId = (id: SettingsSectionId) => `${uid}-tab-${id}`;
  const current = SETTINGS_SECTIONS.find((s) => s.id === section) ?? SETTINGS_SECTIONS[0];
  // Type élargi : une rubrique peut ignorer tout ou partie des props communes.
  const Section: ComponentType<SettingsSectionProps> = current.render;
  const tabsRef = useRef<HTMLElement>(null);

  // Fenêtre étroite ou zoom : la rangée défile ; l'onglet actif (rubrique mémorisée) reste visible.
  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current.id]);

  return (
    <Panel label="Paramètres" title="Paramètres" backTitle="Fermer (Échap)" onBack={onClose}>
      <nav ref={tabsRef} className="tabs settings__tabs" role="tablist" aria-label="Rubriques des paramètres">
        {SETTINGS_SECTIONS.map((s) => (
          <button
            key={s.id}
            id={tabId(s.id)}
            type="button"
            role="tab"
            aria-selected={s.id === current.id}
            aria-controls={`${uid}-panel`}
            className={`tab${s.id === current.id ? ' is-active' : ''}`}
            onClick={() => onSectionChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>
      <div className="form__body settings__body" role="tabpanel" id={`${uid}-panel`} aria-labelledby={tabId(current.id)}>
        <Section
          key={current.id}
          settings={settings}
          onChange={onChange}
          updater={updater}
          aliases={aliases}
          destinations={destinations}
        />
      </div>
    </Panel>
  );
}
