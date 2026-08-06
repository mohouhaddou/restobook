import React from 'react';
import { renderBlock } from '../../../../shared/markdown/MarkdownComponents';
import { DiscoveryCard, DISCOVERY_CALLOUT_KINDS } from './DiscoveryCard';

/**
 * Composition au point d'appel, pas une modification du moteur : pour chaque bloc, utilise le
 * rendu partagé `renderBlock` (frontend/src/shared/markdown/MarkdownComponents.tsx, "la SEULE
 * branche par type de tout le moteur" — volontairement laissé intact) sauf pour les callouts
 * tip/note, remontés en DiscoveryCard. Discover/Sports/le thème Kids par défaut ne voient jamais
 * cette différence : ils continuent d'appeler MarkdownRenderer directement.
 *
 * Reproduit le conteneur de MarkdownRenderer (`theme.classes.container`) pour rester un
 * remplacement direct : tout le CSS déjà écrit contre `.md-kids` (tailles de police, titres
 * masqués, images...) continue de s'appliquer sans changement.
 */
export function AdventureBlocks({ blocks, theme }) {
  return (
    <div className={theme.classes.container}>
      {(blocks || []).map((block, index) => {
        if (block.type === 'callout' && DISCOVERY_CALLOUT_KINDS[block.kind]) {
          return <DiscoveryCard key={index} block={block} labels={theme.calloutLabels}/>;
        }
        return renderBlock(block, theme, index);
      })}
    </div>
  );
}
