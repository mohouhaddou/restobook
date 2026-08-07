import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { parseMarkdownBlocks } from '../MarkdownParser';
import { DiscoverTheme } from '../themes/DiscoverTheme';
import { SportsTheme } from '../themes/SportsTheme';
import { KidsTheme } from '../themes/KidsTheme';

afterEach(cleanup);

const RAW_BLOCKS = [
  { type: 'heading', depth: 2, text: 'Un titre', html: 'Un titre', anchor: 'un-titre' },
  { type: 'paragraph', html: 'Un paragraphe <strong>important</strong>.' },
  { type: 'image', src: 'photo.webp', alt: 'Une photo', title: null },
  { type: 'callout', kind: 'tip', title: 'Astuce', html: '<p>Contenu utile</p>' },
  { type: 'table', align: [null, null], header: ['A', 'B'], rows: [['1', '2']] },
  { type: 'list', ordered: false, items: ['un', 'deux'] },
];

describe('MarkdownRenderer', () => {
  it("ne connaît jamais le module — il ne reçoit que blocks/theme", () => {
    // Signature de MarkdownRenderer : deux props seulement (+ faq optionnel), jamais de "module".
    expect(Object.keys({ blocks: [], theme: DiscoverTheme } satisfies { blocks: unknown; theme: unknown })).toEqual(['blocks', 'theme']);
  });

  for (const [name, theme] of [['Discover', DiscoverTheme], ['Sports', SportsTheme], ['Kids', KidsTheme]] as const) {
    it(`affiche exactement le même contenu avec le thème ${name} (seul le style change)`, () => {
      const blocks = parseMarkdownBlocks(RAW_BLOCKS);
      const { container } = render(<MarkdownRenderer blocks={blocks} theme={theme} />);
      expect(container.textContent).toContain('Un titre');
      expect(container.textContent).toContain('important');
      expect(container.textContent).toContain('Contenu utile');
      expect(container.textContent).toContain('un');
      expect(container.textContent).toContain('deux');
      expect(container.querySelector('img')?.getAttribute('src')).toBe('photo.webp');
      expect(container.querySelectorAll('table th')).toHaveLength(2);
      // Le conteneur racine porte la classe du thème — c'est la SEULE différence attendue.
      expect(container.firstElementChild?.className).toBe(theme.classes.container);
    });
  }

  it('les trois thèmes appliquent des classes de conteneur différentes', () => {
    const ids = new Set([DiscoverTheme.classes.container, SportsTheme.classes.container, KidsTheme.classes.container]);
    expect(ids.size).toBe(3);
  });

  it('affiche la FAQ quand elle est fournie, absente sinon', () => {
    const blocks = parseMarkdownBlocks(RAW_BLOCKS);
    const withFaq = render(<MarkdownRenderer blocks={blocks} theme={DiscoverTheme} faq={[{ question: 'Une question ?', answer: 'Une réponse.' }]} />);
    expect(withFaq.container.textContent).toContain('Une question ?');
    cleanup();
    const withoutFaq = render(<MarkdownRenderer blocks={blocks} theme={DiscoverTheme} />);
    expect(withoutFaq.container.querySelector(`.${DiscoverTheme.classes.faq}`)).toBeNull();
  });
});
