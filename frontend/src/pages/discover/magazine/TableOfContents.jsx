import React from 'react';

// Sommaire — ancres calculées côté backend (articleService.renderBodyWithToc),
// injectées dans body_html avec les mêmes ids. Composant pur.
export default function TableOfContents({ toc }) {
  if (!toc?.length) return null;
  return (
    <nav className="ifm-toc" aria-label="Sommaire">
      <p className="ifm-toc-title">Sommaire</p>
      <ol>
        {toc.map(item => (
          <li key={item.anchor} data-level={item.level}>
            <a href={`#${item.anchor}`}>{item.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
