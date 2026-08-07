/**
 * Source unique de vérité pour "que doit lire le narrateur" — lit UNIQUEMENT l'AST (Block[] issu
 * de MarkdownParser.ts, via les pages déjà calculées par StoryPaginator), jamais le HTML affiché,
 * jamais le DOM, jamais React. Une image n'est jamais un bloc à lire : une page qui ne contient
 * que des images produit un cue `dwell` (l'illustration reste affichée un instant, sans silence
 * dans la file audio) plutôt que d'être simplement absente de la narration.
 */
import type { Block } from '../../../../../markdown/MarkdownParser';
import type { PaginatedPage } from '../StoryPaginator';
import { splitIntoSentences } from './SentenceSplitter';

export const DWELL_DURATION_MS = 2400;

interface BaseCue {
  readonly id: string;
  readonly pageIndex: number;
  readonly chapter: string | null;
}
export interface SentenceCue extends BaseCue {
  readonly type: 'sentence';
  readonly text: string;
  readonly dialogue: boolean;
}
export interface DwellCue extends BaseCue {
  readonly type: 'dwell';
  readonly durationMs: number;
}
export type NarrationCue = SentenceCue | DwellCue;

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Texte brut "lisible" d'un bloc — mêmes blocs éligibles que l'ancien pageReadableText
 * (heading/paragraph/quote/callout/list) ; image/table/code/hr ne sont jamais lus. */
function readableBlockText(block: Block): string {
  switch (block.type) {
    case 'heading': case 'paragraph': case 'quote': return stripHtml(block.html);
    case 'callout': return [block.title, stripHtml(block.html)].filter(Boolean).join(' — ');
    case 'list': return block.items.map(stripHtml).join('. ');
    default: return '';
  }
}

/** Un bloc `quote` représente presque toujours un dialogue dans une Story — forcé, indépendamment
 * de la ponctuation détectée phrase par phrase (voir SentenceSplitter.isDialogueText). */
function isForcedDialogueBlock(block: Block): boolean {
  return block.type === 'quote';
}

/**
 * Construit la timeline de cues à partir des pages déjà paginées. L'ordre des cues suit l'ordre
 * naturel de lecture (page par page, bloc par bloc, phrase par phrase) — jamais celui de l'écran.
 */
export function extractSpeechCues(pages: readonly PaginatedPage[]): NarrationCue[] {
  const cues: NarrationCue[] = [];
  let currentChapter: string | null = null;
  let sentenceCounter = 0;

  pages.forEach((page, pageIndex) => {
    // La couverture (page.kind === 'cover') n'est jamais un moment de narration : elle n'a pas de
    // texte (juste un titre/sous-titre superposés, déjà lus nulle part ailleurs) et ne doit jamais
    // être ciblée par une cue — sinon "Lire toute l'histoire" navigue vers l'écran "Commencer" au
    // tout premier cue (bug constaté en vérification live : la narration renvoyait sur la
    // couverture au lieu de rester sur la scène en cours).
    if (page.kind === 'cover') return;

    const pageCuesBefore = cues.length;

    for (const block of page.blocks) {
      if (block.type === 'heading') currentChapter = block.text;
      if (block.type === 'image') continue; // jamais un bloc à lire

      const text = readableBlockText(block);
      if (!text) continue;

      const forcedDialogue = isForcedDialogueBlock(block);
      for (const sentence of splitIntoSentences(text)) {
        cues.push({
          type: 'sentence',
          id: `s${sentenceCounter++}`,
          pageIndex,
          chapter: currentChapter,
          text: sentence.text,
          dialogue: forcedDialogue || sentence.dialogue,
        });
      }
    }

    // Page sans aucune phrase (page 100% image) : un temps d'affichage, jamais un silence audio.
    if (cues.length === pageCuesBefore) {
      cues.push({
        type: 'dwell',
        id: `d${pageIndex}`,
        pageIndex,
        chapter: currentChapter,
        durationMs: DWELL_DURATION_MS,
      });
    }
  });

  return cues;
}
