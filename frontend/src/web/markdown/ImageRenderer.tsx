import React from 'react';
import type { ImageBlock } from './MarkdownParser';
import type { MarkdownTheme } from './MarkdownTheme';

export function ImageRenderer({ block, theme }: { block: ImageBlock; theme: MarkdownTheme }) {
  return (
    <figure className={theme.classes.image}>
      <img src={block.src} alt={block.alt} title={block.title || undefined} loading="lazy" />
      {theme.showImageCaption && block.alt ? <figcaption>{block.alt}</figcaption> : null}
    </figure>
  );
}
