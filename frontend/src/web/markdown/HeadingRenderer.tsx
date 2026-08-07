import React from 'react';
import type { HeadingBlock } from './MarkdownParser';
import type { MarkdownTheme } from './MarkdownTheme';

const CLASS_BY_DEPTH: Record<number, keyof MarkdownTheme['classes']> = {
  1: 'heading1', 2: 'heading2', 3: 'heading3',
};

export function HeadingRenderer({ block, theme }: { block: HeadingBlock; theme: MarkdownTheme }) {
  const tag = `h${Math.min(Math.max(block.depth, 1), 6)}`;
  const className = theme.classes[CLASS_BY_DEPTH[block.depth] ?? 'heading3'];
  return React.createElement(tag, { id: block.anchor || undefined, className, dangerouslySetInnerHTML: { __html: block.html } });
}
