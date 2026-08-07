import React from 'react';
import type { TableBlock } from './MarkdownParser';
import type { MarkdownTheme } from './MarkdownTheme';

export function TableRenderer({ block, theme }: { block: TableBlock; theme: MarkdownTheme }) {
  const alignStyle = (i: number): React.CSSProperties | undefined => {
    const align = block.align[i];
    return align ? { textAlign: align as React.CSSProperties['textAlign'] } : undefined;
  };
  return (
    <div className={theme.classes.tableWrapper}>
      <table className={theme.classes.table}>
        <thead>
          <tr>
            {block.header.map((cell, i) => (
              <th key={i} style={alignStyle(i)} dangerouslySetInnerHTML={{ __html: cell }} />
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} style={alignStyle(c)} dangerouslySetInnerHTML={{ __html: cell }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
