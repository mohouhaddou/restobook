import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NarrationHighlightRenderer } from '../NarrationHighlightRenderer';
import type { Block } from '../../../../../../shared/markdown/MarkdownParser';
import type { MarkdownTheme } from '../../../../../../shared/markdown/MarkdownTheme';

const THEME: MarkdownTheme = {
  id: 'test', label: 'Test',
  classes: {
    container: 'c-container', heading1: 'c-h1', heading2: 'c-h2', heading3: 'c-h3',
    paragraph: 'c-p', image: 'c-img', table: 'c-table', tableWrapper: 'c-table-wrap',
    quote: 'c-quote', callout: 'c-callout', code: 'c-code', list: 'c-list', faq: 'c-faq',
  },
};

describe('NarrationHighlightRenderer', () => {
  it('découpe un paragraphe en spans de phrases, surlignant uniquement la phrase active', () => {
    const blocks: Block[] = [{ type: 'paragraph', html: '<p>Phrase un. Phrase deux.</p>' }];
    const { container } = render(<NarrationHighlightRenderer blocks={blocks} theme={THEME} activeSentenceText="Phrase deux." />);
    const spans = container.querySelectorAll('.narration-sentence');
    expect(spans).toHaveLength(2);
    expect(spans[0].textContent?.trim()).toBe('Phrase un.');
    expect(spans[0].classList.contains('narration-sentence-active')).toBe(false);
    expect(spans[1].classList.contains('narration-sentence-active')).toBe(true);
  });

  it('aucune phrase surlignée quand activeSentenceText est null (entre deux phrases, ex. dwell)', () => {
    const blocks: Block[] = [{ type: 'paragraph', html: '<p>Une phrase.</p>' }];
    const { container } = render(<NarrationHighlightRenderer blocks={blocks} theme={THEME} activeSentenceText={null} />);
    expect(container.querySelectorAll('.narration-sentence-active')).toHaveLength(0);
  });

  it('un bloc quote est marqué dialogue même sans ponctuation de dialogue', () => {
    const blocks: Block[] = [{ type: 'quote', html: '<p>Il faut y croire.</p>' }];
    const { container } = render(<NarrationHighlightRenderer blocks={blocks} theme={THEME} activeSentenceText={null} />);
    expect(container.querySelector('.narration-sentence-dialogue')).not.toBeNull();
  });

  it('les blocs jamais lus (image/table/code/hr) sont rendus sans logique de surlignage dupliquée', () => {
    const blocks: Block[] = [{ type: 'image', src: 'x.webp', alt: 'x', title: null }];
    const { container } = render(<NarrationHighlightRenderer blocks={blocks} theme={THEME} activeSentenceText={null} />);
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelectorAll('.narration-sentence')).toHaveLength(0);
  });

  it('applique les classes du thème (container/heading/paragraph) — pas de style ad hoc', () => {
    const blocks: Block[] = [{ type: 'heading', depth: 2, text: 'Titre', html: 'Titre', anchor: 'titre' }, { type: 'paragraph', html: '<p>Texte.</p>' }];
    const { container } = render(<NarrationHighlightRenderer blocks={blocks} theme={THEME} activeSentenceText={null} />);
    expect(container.firstElementChild?.className).toBe('c-container');
    expect(container.querySelector('h2')?.className).toBe('c-h2');
    expect(container.querySelector('p')?.className).toBe('c-p');
  });
});
