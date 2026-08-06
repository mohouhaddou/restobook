import React from 'react';
import type { MarkdownTheme } from '../../../../shared/markdown/MarkdownTheme';
import type { PaginatedPage } from './StoryPaginator';
import type { StoryLayoutBox } from './StoryLayoutEngine';
import { BookRenderer } from './BookRenderer';

export interface StoryRendererProps {
  readonly pages: readonly PaginatedPage[];
  readonly layout: StoryLayoutBox;
  readonly currentIndex: number;
  readonly onNavigate: (index: number) => void;
  readonly theme: MarkdownTheme;
  readonly activeSentenceText?: string | null;
  readonly onStart?: () => void;
  readonly startLabel?: string;
  readonly endContent?: React.ReactNode;
}

/**
 * Composant "bête" : reçoit le layout déjà tranché par StoryLayoutEngine et les pages déjà
 * calculées par StoryPaginator, et délègue tel quel à BookRenderer. Ne contient et ne doit
 * jamais contenir aucun test de largeur/orientation — c'est la responsabilité exclusive de
 * StoryLayoutEngine, en amont.
 */
export function StoryRenderer(props: StoryRendererProps) {
  return <BookRenderer {...props} />;
}
