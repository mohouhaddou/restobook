import { describe, it, expect } from 'vitest';
import { extractSpeechCues, DWELL_DURATION_MS } from '../SpeechExtractor';
import { createNarrationTimeline } from '../NarrationTimeline';
import type { Block } from '../../../../../../markdown/MarkdownParser';
import type { PaginatedPage } from '../../StoryPaginator';

function paragraph(html: string): Block { return { type: 'paragraph', html }; }
function heading(text: string, depth = 2): Block { return { type: 'heading', depth, text, html: text, anchor: text }; }
function image(src: string): Block { return { type: 'image', src, alt: '', title: null }; }
function quote(html: string): Block { return { type: 'quote', html }; }

function page(blocks: Block[]): PaginatedPage {
  return { blocks, image: null, kind: 'scene', isChapterStart: false };
}
function coverPage(title: string): PaginatedPage {
  return { blocks: [], image: null, kind: 'cover', isChapterStart: false, title, subtitle: null };
}

describe('extractSpeechCues', () => {
  it('ignore totalement les blocs image — jamais un bloc à lire', () => {
    const pages = [page([image('cover.webp'), paragraph('<p>Bonjour le monde.</p>')])];
    const cues = extractSpeechCues(pages);
    expect(cues.every(c => c.type !== 'sentence' || !c.text.includes('cover'))).toBe(true);
    expect(cues.some(c => c.type === 'sentence')).toBe(true);
  });

  it('une page qui commence par une image ne bloque pas la narration : la phrase suivante démarre normalement', () => {
    const pages = [page([image('cover.webp'), paragraph('<p>La suite du texte arrive tout de suite.</p>')])];
    const cues = extractSpeechCues(pages);
    const first = cues[0];
    expect(first.type).toBe('sentence');
    if (first.type === 'sentence') expect(first.text).toContain('La suite du texte arrive tout de suite');
  });

  it('une page 100% image produit un cue dwell, jamais un silence dans la file de phrases', () => {
    const pages = [page([paragraph('<p>Avant.</p>')]), page([image('illustration.webp')]), page([paragraph('<p>Après.</p>')])];
    const cues = extractSpeechCues(pages);
    const dwell = cues.find(c => c.pageIndex === 1);
    expect(dwell?.type).toBe('dwell');
    if (dwell?.type === 'dwell') expect(dwell.durationMs).toBe(DWELL_DURATION_MS);
  });

  it('découpe chaque bloc lisible en phrases et associe la bonne page à chacune', () => {
    const pages = [
      page([paragraph('<p>Première phrase. Deuxième phrase.</p>')]),
      page([paragraph('<p>Troisième phrase sur la page suivante.</p>')]),
    ];
    const cues = extractSpeechCues(pages);
    const sentences = cues.filter(c => c.type === 'sentence');
    expect(sentences).toHaveLength(3);
    expect(sentences[0].pageIndex).toBe(0);
    expect(sentences[1].pageIndex).toBe(0);
    expect(sentences[2].pageIndex).toBe(1);
  });

  it('associe le dernier titre de chapitre vu à chaque phrase qui suit, jusqu\'au chapitre suivant', () => {
    const pages = [
      page([heading('Chapitre 1', 2), paragraph('<p>Texte du premier chapitre.</p>')]),
      page([heading('Chapitre 2', 2), paragraph('<p>Texte du second chapitre.</p>')]),
    ];
    const cues = extractSpeechCues(pages).filter(c => c.type === 'sentence');
    expect(cues[0].chapter).toBe('Chapitre 1'); // le titre lui-même est une phrase
    expect(cues[1].chapter).toBe('Chapitre 1');
    expect(cues[2].chapter).toBe('Chapitre 2');
    expect(cues[3].chapter).toBe('Chapitre 2');
  });

  it('un bloc quote est toujours marqué dialogue, même sans marqueur de ponctuation', () => {
    const pages = [page([quote('<p>Il faut y croire.</p>')])];
    const cues = extractSpeechCues(pages).filter(c => c.type === 'sentence');
    expect(cues[0].dialogue).toBe(true);
  });

  it('la couverture (kind "cover") ne produit jamais aucune cue, ni phrase ni dwell', () => {
    // Bug constaté en vérification live : "Lire toute l'histoire" démarrait sur le cue 0, qui
    // ciblait la couverture (page.blocks vide → un dwell sur pageIndex 0) — la lecture renvoyait
    // alors l'utilisateur sur l'écran "Commencer" au lieu de rester sur la scène en cours.
    const pages = [coverPage('Le titre du livre'), page([paragraph('<p>Premier vrai texte.</p>')])];
    const cues = extractSpeechCues(pages);
    expect(cues.every(c => c.pageIndex !== 0)).toBe(true);
    expect(cues[0].pageIndex).toBe(1);
    expect(cues[0].type).toBe('sentence');
  });

  it('ignore silencieusement table/code/hr (jamais lus)', () => {
    const pages = [page([
      { type: 'table', align: [], header: ['A'], rows: [['1']] },
      { type: 'code', lang: 'js', text: 'console.log(1)' },
      { type: 'hr' },
      paragraph('<p>Le seul texte lisible.</p>'),
    ])];
    const cues = extractSpeechCues(pages).filter(c => c.type === 'sentence');
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toContain('Le seul texte lisible');
  });
});

describe('createNarrationTimeline', () => {
  it('retrouve le premier cue de chaque page et chapitre', () => {
    const pages = [
      page([heading('Chapitre 1'), paragraph('<p>A. B.</p>')]),
      page([image('x.webp')]),
      page([heading('Chapitre 2'), paragraph('<p>C.</p>')]),
    ];
    const timeline = createNarrationTimeline(extractSpeechCues(pages));
    expect(timeline.chapters).toEqual(['Chapitre 1', 'Chapitre 2']);
    expect(timeline.cueAt(timeline.firstIndexForPage(1))?.type).toBe('dwell');
    expect(timeline.cueAt(timeline.firstIndexForChapter('Chapitre 2'))?.chapter).toBe('Chapitre 2');
    expect(timeline.isLast(timeline.cues.length - 1)).toBe(true);
  });

  it('indexOf retrouve un cue par son id, -1 si absent', () => {
    const pages = [page([paragraph('<p>Seule phrase.</p>')])];
    const timeline = createNarrationTimeline(extractSpeechCues(pages));
    expect(timeline.indexOf(timeline.cues[0].id)).toBe(0);
    expect(timeline.indexOf('inexistant')).toBe(-1);
  });
});
