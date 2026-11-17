/** Écart (px) sous lequel une rangée est considérée au bout : arrondis des mesures. */
const EPSILON = 1;

/**
 * Rangée défilante (onglets) qui déborde : pose `data-fade` (`start`, `end` ou `both`) sur
 * l'élément, côté où du contenu est caché ; la feuille de style y fond le bord (`mask-image`).
 * Sans débordement, aucun attribut : rien n'est estompé. Aucun rendu React : l'attribut est
 * écrit directement, au redimensionnement et au défilement seulement.
 *
 * Fonction de référence React 19 (`ref={overflowFade}`) : renvoie son nettoyage.
 */
export function overflowFade(el: HTMLElement | null): (() => void) | undefined {
  if (!el) return undefined;
  const update = () => {
    const start = el.scrollLeft > EPSILON;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - EPSILON;
    const fade = start && end ? 'both' : start ? 'start' : end ? 'end' : null;
    if (fade === null) delete el.dataset.fade;
    else if (el.dataset.fade !== fade) el.dataset.fade = fade;
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(el);
  // Le contenu peut changer de largeur sans que la rangée change (compteurs chargés).
  for (const child of el.children) observer.observe(child);
  el.addEventListener('scroll', update, { passive: true });
  return () => {
    observer.disconnect();
    el.removeEventListener('scroll', update);
  };
}
