import React from 'react';
import type { MarkdownTheme } from '../../../../shared/markdown/MarkdownTheme';
import type { StoryLayoutBox } from './StoryLayoutEngine';
import type { PaginatedPage } from './StoryPaginator';
import { CoverPage } from './CoverPage';
import { ScenePage } from './ScenePage';

export interface BookPageProps {
  readonly page: PaginatedPage;
  readonly pageNumber: number;
  readonly totalPages: number;
  readonly theme: MarkdownTheme;
  readonly layout: StoryLayoutBox;
  readonly activeSentenceText?: string | null;
  readonly onStart: () => void;
  readonly startLabel?: string;
}

/**
 * Un écran du livre : la couverture (CoverPage, une seule fois, en tout premier) ou une scène
 * (ScenePage, illustration + texte). Choisit uniquement QUEL composant afficher — aucune décision
 * desktop/tablette/mobile ici, ça vient déjà tranché par StoryLayoutEngine en amont.
 */
export function BookPage({ page, pageNumber, totalPages, theme, layout, activeSentenceText, onStart, startLabel }: BookPageProps) {
  if (page.kind === 'cover') {
    return (
      <div className="story-page story-page--cover" dir={layout.direction}>
        <CoverPage
          image={page.image ?? { type: 'image', src: '', alt: '', title: null }}
          title={page.title ?? ''}
          subtitle={page.subtitle}
          onStart={onStart}
          startLabel={startLabel ?? 'Commencer'}
        />
      </div>
    );
  }

  return (
    <div className="story-page" dir={layout.direction}>
      <ScenePage page={page} theme={theme} layout={layout} activeSentenceText={activeSentenceText} />
      <div className="story-page-number" aria-hidden="true">{pageNumber} / {totalPages}</div>
      <span className="sr-only">{`Page ${pageNumber} sur ${totalPages}`}</span>
    </div>
  );
}
