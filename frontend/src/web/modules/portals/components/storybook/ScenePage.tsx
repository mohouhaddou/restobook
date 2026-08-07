import React from 'react';
import type { MarkdownTheme } from '../../../../markdown/MarkdownTheme';
import { MarkdownRenderer } from '../../../../markdown/MarkdownRenderer';
import { type PaginatedPage, SCENE_TEXT_CLASS, TEXT_MAX_WIDTH_PX, textZonePaddingFor } from './StoryPaginator';
import type { StoryLayoutBox } from './StoryLayoutEngine';
import { imageSideFor } from './RTLLayoutManager';
import { NarrationHighlightRenderer } from './narration/NarrationHighlightRenderer';

export interface ScenePageProps {
  readonly page: PaginatedPage;
  readonly theme: MarkdownTheme;
  readonly layout: StoryLayoutBox;
  readonly activeSentenceText?: string | null;
}

/**
 * Une "scène" — la seule unité de mise en page pour tout ce qui n'est pas la couverture : une
 * illustration qui occupe TOUJOURS 100% de sa zone (jamais une vignette perdue dans du vide) et le
 * texte qui l'accompagne, TOUJOURS aligné en haut de sa colonne (jamais centré verticalement).
 *
 * PAYSAGE (bureau/tablette) : les deux zones se partagent la LARGEUR, côte à côte — le côté de
 * l'illustration dépend du sens de lecture (RTLLayoutManager.imageSideFor), jamais testé ici
 * directement. PORTRAIT (mobile) : empilées, illustration en haut, texte en dessous, toujours dans
 * cet ordre quel que soit le sens de lecture (une pile verticale n'a pas de "gauche/droite").
 *
 * Si `page.isChapterStart`, le premier bloc (un titre) reçoit un traitement typographique dédié
 * (grand, sérif) au lieu du rendu MarkdownRenderer générique — jamais seul sur sa page (garanti en
 * amont par StoryPaginator/ChapterLayoutManager), le texte qui suit s'enchaîne immédiatement.
 */
export function ScenePage({ page, theme, layout, activeSentenceText }: ScenePageProps) {
  const imageSide = layout.mode === 'spread' ? imageSideFor(layout.direction) : 'top';
  const chapterHeading = page.isChapterStart ? page.blocks[0] : null;
  const bodyBlocks = page.isChapterStart ? page.blocks.slice(1) : page.blocks;
  // Padding calculé en JS à partir des MÊMES ratios que StoryPaginator.textZonePaddingFor — un
  // padding-top/bottom en % CSS se résout contre la LARGEUR du bloc, jamais sa hauteur (spec CSS),
  // ce qui désynchroniserait la mesure hors-écran du rendu réel (piège déjà rencontré ici).
  const { paddingX, paddingY } = layout.width > 0 ? textZonePaddingFor(layout) : { paddingX: 0, paddingY: 0 };

  return (
    <div className={`scene scene--${layout.mode === 'spread' ? 'row' : 'column'} scene--image-${imageSide}`}>
      <div className="scene-image">
        {page.image && <img src={page.image.src} alt={page.image.alt} title={page.image.title || undefined} />}
      </div>
      {/* dir posé ICI, jamais sur `.scene` (voir storybook.css : `.scene { direction: ltr }`) —
       * `.scene` est un conteneur flex qui place image/texte CÔTE À CÔTE ; un `direction: rtl`
       * hérité y inverserait l'ordre visuel de ses enfants, annulant (ou doublant) le
       * `flex-direction: row-reverse` déjà posé explicitement par `.scene--image-right` — piège
       * déjà rencontré et évité pour BookRenderer.tsx dans un chantier précédent, reproduit ici au
       * niveau de la scène. Le texte, lui, doit bien s'aligner selon le sens de lecture. */}
      <div className="scene-text" dir={layout.direction} style={{ padding: `${paddingY}px ${paddingX}px` }}>
        {/* SCENE_TEXT_CLASS : même classe que le conteneur du mesureur hors-écran (voir
         * StoryPaginator.createMeasurer) — garantit une typographie identique mesure/rendu. */}
        <div className={SCENE_TEXT_CLASS} style={{ maxWidth: TEXT_MAX_WIDTH_PX }}>
          {chapterHeading && chapterHeading.type === 'heading' && (
            <h2 className="scene-chapter-title">{chapterHeading.text}</h2>
          )}
          {activeSentenceText !== undefined
            ? <NarrationHighlightRenderer blocks={bodyBlocks} theme={theme} activeSentenceText={activeSentenceText} />
            : <MarkdownRenderer blocks={bodyBlocks} theme={theme} />}
        </div>
      </div>
    </div>
  );
}
