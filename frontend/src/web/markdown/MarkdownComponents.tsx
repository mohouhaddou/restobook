import React from 'react';
import type { Block } from './MarkdownParser';
import type { MarkdownTheme } from './MarkdownTheme';
import { HeadingRenderer } from './HeadingRenderer';
import { ImageRenderer } from './ImageRenderer';
import { TableRenderer } from './TableRenderer';
import { QuoteRenderer } from './QuoteRenderer';
import { CalloutRenderer } from './CalloutRenderer';
import { CodeRenderer } from './CodeRenderer';

export { HeadingRenderer, ImageRenderer, TableRenderer, QuoteRenderer, CalloutRenderer, CodeRenderer };
export { FAQRenderer } from './FAQRenderer';

function ParagraphRenderer({ block, theme }: { block: Extract<Block, { type: 'paragraph' }>; theme: MarkdownTheme }) {
  return <p className={theme.classes.paragraph} dangerouslySetInnerHTML={{ __html: block.html }} />;
}

function ListRenderer({ block, theme }: { block: Extract<Block, { type: 'list' }>; theme: MarkdownTheme }) {
  const Tag = block.ordered ? 'ol' : 'ul';
  return (
    <Tag className={theme.classes.list}>
      {block.items.map((html, i) => <li key={i} dangerouslySetInnerHTML={{ __html: html }} />)}
    </Tag>
  );
}

/**
 * Table de dispatch bloc -> composant. C'est la SEULE branche par "type" de tout
 * le moteur, et elle est indexée par type de bloc Markdown (heading/image/table/...),
 * jamais par module (discover/sports/kids). Ajouter un type de bloc = une entrée ici ;
 * ajouter un module = un thème (voir ThemeRegistry), jamais une entrée ici.
 */
export function renderBlock(block: Block, theme: MarkdownTheme, key: number): React.ReactNode {
  switch (block.type) {
    case 'heading': return <HeadingRenderer key={key} block={block} theme={theme} />;
    case 'paragraph': return <ParagraphRenderer key={key} block={block} theme={theme} />;
    case 'image': return <ImageRenderer key={key} block={block} theme={theme} />;
    case 'table': return <TableRenderer key={key} block={block} theme={theme} />;
    case 'quote': return <QuoteRenderer key={key} block={block} theme={theme} />;
    case 'callout': return <CalloutRenderer key={key} block={block} theme={theme} />;
    case 'code': return <CodeRenderer key={key} block={block} theme={theme} />;
    case 'list': return <ListRenderer key={key} block={block} theme={theme} />;
    case 'hr': return <hr key={key} />;
    default: return null;
  }
}
