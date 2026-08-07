import { describe, it, expect } from 'vitest';
import { createNarrationCursor } from '../NarrationCursor';
import { createNarrationTimeline } from '../NarrationTimeline';
import { extractSpeechCues } from '../SpeechExtractor';
import type { Block } from '../../../../../../markdown/MarkdownParser';
import type { PaginatedPage } from '../../StoryPaginator';

function paragraph(html: string): Block { return { type: 'paragraph', html }; }
function heading(text: string): Block { return { type: 'heading', depth: 2, text, html: text, anchor: text }; }
function image(src: string): Block { return { type: 'image', src, alt: '', title: null }; }
function page(blocks: Block[]): PaginatedPage {
  return { blocks, image: null, kind: 'scene', isChapterStart: false };
}

function buildTimeline() {
  const pages = [
    page([heading('Chapitre 1'), paragraph('<p>Phrase A. Phrase B.</p>')]),
    page([image('x.webp')]),
    page([heading('Chapitre 2'), paragraph('<p>Phrase C.</p>')]),
  ];
  return createNarrationTimeline(extractSpeechCues(pages));
}

describe('NarrationCursor', () => {
  it('démarre à index 0 par défaut', () => {
    const cursor = createNarrationCursor(buildTimeline());
    expect(cursor.index).toBe(0);
    expect(cursor.atEnd).toBe(false);
  });

  it('next() avance d\'un cue, jusqu\'à atEnd sur le dernier', () => {
    const timeline = buildTimeline();
    let cursor = createNarrationCursor(timeline);
    for (let i = 0; i < timeline.cues.length - 1; i++) cursor = cursor.next();
    expect(cursor.atEnd).toBe(true);
    // next() au-delà de la fin reste clampé, ne sort jamais du tableau.
    cursor = cursor.next();
    expect(cursor.index).toBe(timeline.cues.length - 1);
  });

  it('jumpToChapter positionne le curseur sur le premier cue du chapitre demandé', () => {
    const timeline = buildTimeline();
    const cursor = createNarrationCursor(timeline).jumpToChapter('Chapitre 2');
    expect(cursor.cue?.chapter).toBe('Chapitre 2');
  });

  it('jumpToPage positionne le curseur sur le premier cue de la page demandée (y compris une page dwell)', () => {
    const timeline = buildTimeline();
    const cursor = createNarrationCursor(timeline).jumpToPage(1);
    expect(cursor.cue?.type).toBe('dwell');
    expect(cursor.cue?.pageIndex).toBe(1);
  });

  it('jumpToSentence retrouve un cue par son id ; un id inconnu ne bouge pas le curseur', () => {
    const timeline = buildTimeline();
    const targetId = timeline.cues[2].id;
    const cursor = createNarrationCursor(timeline).jumpToSentence(targetId);
    expect(cursor.cue?.id).toBe(targetId);
    const unchanged = createNarrationCursor(timeline, 1).jumpToSentence('id-inexistant');
    expect(unchanged.index).toBe(1);
  });
});
