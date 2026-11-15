import { CardVisual } from './Thumb';

/**
 * Calques peints d'une carte à deux étapes : image unique découpée en deux triangles, et repères.
 *
 * `.card__art` porte tout ce qui est peint (fond, image ou monogramme, reflet, dégradé du nom) et
 * n'est découpé qu'une fois (`--mt-zone-both`) : l'interstice entre les triangles n'est pas peint.
 * L'image n'existe qu'une fois, avec le cadrage d'une carte classique. Partagé par la grille
 * (`CompactCard`) et l'aperçu du formulaire (`DestinationForm`).
 */
export function SplitCardArt({ name, image }: { name: string; image: string | null }) {
  return (
    <>
      <span className="card__art">
        <CardVisual name={name} image={image} />
      </span>
      <span className="card__step card__step--1" aria-hidden>
        1
      </span>
      <span className="card__step card__step--2" aria-hidden>
        2
      </span>
    </>
  );
}
