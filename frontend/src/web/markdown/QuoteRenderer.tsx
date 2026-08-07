import React from 'react';
import type { QuoteBlock } from './MarkdownParser';
import type { MarkdownTheme } from './MarkdownTheme';

export function QuoteRenderer({ block, theme }: { block: QuoteBlock; theme: MarkdownTheme }) {
  return <blockquote className={theme.classes.quote} dangerouslySetInnerHTML={{ __html: block.html }} />;
}
