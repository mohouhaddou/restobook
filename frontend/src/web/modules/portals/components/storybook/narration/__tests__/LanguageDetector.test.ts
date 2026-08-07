import { describe, it, expect } from 'vitest';
import { detectStoryLanguage } from '../LanguageDetector';
import type { Block } from '../../../../../../markdown/MarkdownParser';

function heading(text: string): Block { return { type: 'heading', depth: 1, text, html: text, anchor: text }; }
function paragraph(html: string): Block { return { type: 'paragraph', html }; }
function image(src: string): Block { return { type: 'image', src, alt: '', title: null }; }

describe('detectStoryLanguage', () => {
  it('détecte le français à partir du texte réel, peu importe la langue de l\'UI', () => {
    const blocks: Block[] = [
      heading('La princesse Lina et le secret des sourires'),
      paragraph('<p>Un matin, tous les sourires du royaume semblent s’être envolés.</p>'),
    ];
    expect(detectStoryLanguage(blocks)).toBe('fr');
  });

  it('détecte l\'anglais à partir de marqueurs très fréquents', () => {
    const blocks: Block[] = [
      heading('The brave little fox'),
      paragraph('<p>Once upon a time, there was a fox who lived in the forest with his friends.</p>'),
    ];
    expect(detectStoryLanguage(blocks)).toBe('en');
  });

  it('détecte l\'arabe via son script Unicode, de façon fiable', () => {
    const blocks: Block[] = [heading('الأميرة الشجاعة'), paragraph('<p>في يوم من الأيام، عاشت أميرة شجاعة في قصر كبير.</p>')];
    expect(detectStoryLanguage(blocks)).toBe('ar');
  });

  it('ignore les blocs image (jamais de texte à analyser dedans)', () => {
    const blocks: Block[] = [image('cover.webp'), heading('Une histoire en français'), paragraph('<p>Il était une fois.</p>')];
    expect(detectStoryLanguage(blocks)).toBe('fr');
  });

  it('retombe sur le français par défaut si aucun texte exploitable (à égalité ou vide)', () => {
    expect(detectStoryLanguage([])).toBe('fr');
    expect(detectStoryLanguage([image('cover.webp')])).toBe('fr');
  });
});
