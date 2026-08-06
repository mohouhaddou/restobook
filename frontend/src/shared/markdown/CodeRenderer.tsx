import React from 'react';
import type { CodeBlock } from './MarkdownParser';
import type { MarkdownTheme } from './MarkdownTheme';

export function CodeRenderer({ block, theme }: { block: CodeBlock; theme: MarkdownTheme }) {
  return (
    <pre className={theme.classes.code}>
      {block.lang ? <span className={`${theme.classes.code}-lang`}>{block.lang}</span> : null}
      <code>{block.text}</code>
    </pre>
  );
}
