/**
 * Position courante dans la NarrationTimeline — permet de "reprendre depuis cette phrase / ce
 * chapitre / cette page" sans que le NarrationController ait à connaître la structure de la
 * timeline (pages, chapitres) : le curseur fait la traduction.
 */
import type { NarrationTimeline } from './NarrationTimeline';
import type { NarrationCue } from './SpeechExtractor';

export interface NarrationCursor {
  readonly index: number;
  readonly cue: NarrationCue | undefined;
  readonly atEnd: boolean;
  next(): NarrationCursor;
  jumpToIndex(index: number): NarrationCursor;
  jumpToSentence(cueId: string): NarrationCursor;
  jumpToChapter(chapter: string): NarrationCursor;
  jumpToPage(pageIndex: number): NarrationCursor;
}

function build(timeline: NarrationTimeline, index: number): NarrationCursor {
  const clamped = Math.max(0, Math.min(index, Math.max(0, timeline.cues.length - 1)));
  return {
    index: clamped,
    cue: timeline.cueAt(clamped),
    atEnd: timeline.cues.length === 0 || timeline.isLast(clamped),
    next: () => build(timeline, clamped + 1),
    jumpToIndex: i => build(timeline, i),
    jumpToSentence: cueId => build(timeline, timeline.indexOf(cueId) >= 0 ? timeline.indexOf(cueId) : clamped),
    jumpToChapter: chapter => {
      const target = timeline.firstIndexForChapter(chapter);
      return build(timeline, target >= 0 ? target : clamped);
    },
    jumpToPage: pageIndex => {
      const target = timeline.firstIndexForPage(pageIndex);
      return build(timeline, target >= 0 ? target : clamped);
    },
  };
}

export function createNarrationCursor(timeline: NarrationTimeline, startIndex = 0): NarrationCursor {
  return build(timeline, startIndex);
}
