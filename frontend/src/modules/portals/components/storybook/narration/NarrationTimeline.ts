/**
 * Vue indexée, immuable, de la liste de cues produite par SpeechExtractor — chaque phrase a
 * {id, page, chapitre, texte} (le début/fin audio réel n'est connu qu'à la synthèse, voir
 * NarrationQueue.ts ; ce module ne connaît que l'ORDRE et les correspondances page/chapitre).
 */
import type { NarrationCue } from './SpeechExtractor';

export interface NarrationTimeline {
  readonly cues: readonly NarrationCue[];
  readonly chapters: readonly string[];
  cueAt(index: number): NarrationCue | undefined;
  indexOf(cueId: string): number;
  firstIndexForPage(pageIndex: number): number;
  firstIndexForChapter(chapter: string): number;
  isLast(index: number): boolean;
}

export function createNarrationTimeline(cues: readonly NarrationCue[]): NarrationTimeline {
  const chapters: string[] = [];
  for (const cue of cues) {
    if (cue.chapter && chapters[chapters.length - 1] !== cue.chapter) chapters.push(cue.chapter);
  }

  const idIndex = new Map<string, number>();
  cues.forEach((cue, i) => idIndex.set(cue.id, i));

  const firstPageIndex = new Map<number, number>();
  cues.forEach((cue, i) => { if (!firstPageIndex.has(cue.pageIndex)) firstPageIndex.set(cue.pageIndex, i); });

  const firstChapterIndex = new Map<string, number>();
  cues.forEach((cue, i) => { if (cue.chapter && !firstChapterIndex.has(cue.chapter)) firstChapterIndex.set(cue.chapter, i); });

  return {
    cues,
    chapters,
    cueAt: index => cues[index],
    indexOf: cueId => idIndex.get(cueId) ?? -1,
    firstIndexForPage: pageIndex => firstPageIndex.get(pageIndex) ?? -1,
    firstIndexForChapter: chapter => firstChapterIndex.get(chapter) ?? -1,
    isLast: index => index === cues.length - 1,
  };
}
