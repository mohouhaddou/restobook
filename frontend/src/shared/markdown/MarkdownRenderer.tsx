import React from 'react';
import type { Block, FaqItem, TocItem } from './MarkdownParser';
import type { MarkdownTheme } from './MarkdownTheme';
import { renderBlock, FAQRenderer } from './MarkdownComponents';

export interface MarkdownRendererProps {
  readonly blocks: readonly Block[];
  readonly theme: MarkdownTheme;
  readonly faq?: readonly FaqItem[];
  readonly faqTitle?: string;
  /** Optionnel, purement pour permettre à une page d'afficher son propre sommaire ; le renderer ne l'affiche pas lui-même. */
  readonly toc?: readonly TocItem[];
}

/**
 * Moteur de rendu Markdown unique, partagé par Discover/Sports/Kids/Stories.
 * Ne reçoit JAMAIS de notion de "module" — uniquement des blocs déjà parsés et
 * un thème. Toute différence visuelle entre modules vient exclusivement de
 * `theme` (voir ThemeResolver/ThemeRegistry), jamais d'un branchement ici.
 */
export function MarkdownRenderer({ blocks, theme, faq, faqTitle }: MarkdownRendererProps) {
  return (
    <div className={theme.classes.container}>
      {blocks.map((block, i) => renderBlock(block, theme, i))}
      {faq?.length ? <FAQRenderer faq={faq} theme={theme} title={faqTitle} /> : null}
    </div>
  );
}
