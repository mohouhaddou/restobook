import { createPortal } from 'react-dom';

/**
 * Échappe un overlay `position:fixed` de son arbre React vers `document.body`.
 * Nécessaire car `.mk-fade-up`/`.mk-fade-in` (animation CSS sur `transform`)
 * créent un bloc de confinement pour tout descendant `fixed` tant que
 * l'animation est "remplie" (`animation-fill-mode: both`) — un modal
 * `position:fixed` rendu à l'intérieur se retrouve alors positionné/rogné par
 * rapport à ce conteneur au lieu du viewport entier (bug constaté sur
 * PresetPickerModal/BestStoreResultSheet imbriqués dans ShoppingListsPage).
 */
export function Portal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
