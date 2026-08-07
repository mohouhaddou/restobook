import { describe, it, expect } from 'vitest';
import { startsChapter, shouldForceNewPageBefore } from '../ChapterLayoutManager';
import type { Block } from '../../../../../markdown/MarkdownParser';

function heading(text: string): Block { return { type: 'heading', depth: 2, text, html: text, anchor: text }; }
function paragraph(id: string): Block { return { type: 'paragraph', html: `<p>${id}</p>` }; }

describe('startsChapter', () => {
  it('un bloc heading démarre un chapitre (même convention que SpeechExtractor du Narration Engine)', () => {
    expect(startsChapter(heading('Chapitre 1'))).toBe(true);
  });
  it('les autres types de blocs ne démarrent jamais un chapitre', () => {
    expect(startsChapter(paragraph('x'))).toBe(false);
  });
});

describe('shouldForceNewPageBefore', () => {
  it('un chapitre en tout DÉBUT de page (page vide) ne force jamais de saut supplémentaire', () => {
    expect(shouldForceNewPageBefore(heading('Chapitre 2'), false)).toBe(false);
  });
  it('un chapitre qui arriverait au milieu d’une page déjà occupée force un saut de page', () => {
    expect(shouldForceNewPageBefore(heading('Chapitre 2'), true)).toBe(true);
  });
  it('un bloc normal ne force jamais de saut, page occupée ou non', () => {
    expect(shouldForceNewPageBefore(paragraph('x'), true)).toBe(false);
    expect(shouldForceNewPageBefore(paragraph('x'), false)).toBe(false);
  });
});
