import React from 'react';
import type { FaqItem } from './MarkdownParser';
import type { MarkdownTheme } from './MarkdownTheme';

/**
 * Accordéon FAQ via <details>/<summary> natif (SSR-safe, sans useState) — même
 * technique que frontend/src/pages/discover/magazine/FaqAccordion.jsx, généralisée
 * pour être pilotée par `theme` au lieu de classes CSS Discover en dur.
 */
export function FAQRenderer({ faq, theme, title = 'Questions fréquentes' }: { faq: readonly FaqItem[]; theme: MarkdownTheme; title?: string }) {
  if (!faq.length) return null;
  return (
    <section className={theme.classes.faq} aria-label={title}>
      <h2>{title}</h2>
      {faq.map((item, i) => (
        <details key={i} className={`${theme.classes.faq}-item`}>
          <summary className={`${theme.classes.faq}-question`}>{item.question}</summary>
          <div className={`${theme.classes.faq}-answer`}>{item.answer}</div>
        </details>
      ))}
    </section>
  );
}
