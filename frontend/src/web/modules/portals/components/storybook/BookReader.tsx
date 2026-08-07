import React from 'react';
import type { Block } from '../../../../markdown/MarkdownParser';
import type { MarkdownTheme } from '../../../../markdown/MarkdownTheme';
import { AdventureBookEngine, type AdventureBookEngineProps } from '../adventure/AdventureBookEngine';

export interface BookReaderProps {
  readonly blocks: readonly Block[];
  readonly theme: MarkdownTheme;
  readonly title?: string;
  readonly coverImage?: string;
  /** Retour au portail + plein écran — affichés dans la barre de narration (voir NarrationBar.tsx),
   * la page Stories n'a plus de barre supérieure séparée. */
  readonly backTo?: string;
  readonly backLabel?: string;
  readonly isFullscreen?: boolean;
  readonly onToggleFullscreen?: () => void;
  readonly publication?: AdventureBookEngineProps['publication'];
  readonly uiLanguage?: string;
  readonly onProgressChange?: (progress: { pageIndex: number; totalPages: number; completed: boolean }) => void;
}

/**
 * Racine du StoryBook pour Stories — désormais un simple appel à AdventureBookEngine (voir
 * frontend/src/modules/portals/components/adventure/AdventureBookEngine.tsx), le moteur partagé
 * avec Study/Encyclopedia depuis le plan "Unify the Educational Reader with the Storybook
 * engine". Stories conserve la narration et ouvre désormais directement la première scène, sans couverture interne ; jamais de panneau latéral
 * — c'est exactement ce que faisait ce fichier avant l'extraction, juste déplacé.
 */
export function BookReader(props: BookReaderProps) {
  return <AdventureBookEngine {...props} enableNarration skipCover />;
}
