import React from 'react';
import { Lightbulb, Info, AlertTriangle, Pin } from 'lucide-react';
import type { Block, CalloutKind } from '../../../../../shared/markdown/MarkdownParser';
import type { MarkdownTheme } from '../../../../../shared/markdown/MarkdownTheme';
import { MarkdownRenderer } from '../../../../../shared/markdown/MarkdownRenderer';
import { splitIntoSentences } from './SentenceSplitter';
import { stripHtml } from './SpeechExtractor';

const CALLOUT_LABELS: Record<CalloutKind, string> = { tip: 'Astuce', info: 'Info', warning: 'Attention', note: 'Note' };
const CALLOUT_ICONS: Record<CalloutKind, React.ComponentType<{ size?: number }>> = { tip: Lightbulb, info: Info, warning: AlertTriangle, note: Pin };

/**
 * Rendu "surlignage phrase par phrase" (effet Kindle/Apple Books Read Along) — StoryBook
 * UNIQUEMENT, actif seulement pendant une narration en cours. Compromis assumé et documenté
 * (voir le plan de ce chantier) : pendant la narration, le texte perd son HTML inline (gras/
 * liens) au profit du découpage en phrases surlignables ; c'est réversible dès que la lecture
 * s'arrête (ScenePage.tsx retombe alors sur MarkdownRenderer, HTML riche intact).
 *
 * Ne réimplémente PAS le rendu des blocs qui ne sont jamais lus par le narrateur (image/table/
 * code/hr) : ceux-ci sont délégués tels quels à MarkdownRenderer, pour ne dupliquer aucune
 * logique de rendu à leur sujet.
 */
export interface NarrationHighlightRendererProps {
  readonly blocks: readonly Block[];
  readonly theme: MarkdownTheme;
  readonly activeSentenceText: string | null;
}

function HighlightedSentences({ text, activeSentenceText, forceDialogue }: { text: string; activeSentenceText: string | null; forceDialogue?: boolean }) {
  const sentences = splitIntoSentences(text);
  return (
    <>
      {sentences.map((sentence, i) => {
        const active = activeSentenceText !== null && sentence.text === activeSentenceText;
        const classNames = ['narration-sentence'];
        if (sentence.dialogue || forceDialogue) classNames.push('narration-sentence-dialogue');
        if (active) classNames.push('narration-sentence-active');
        return (
          <span key={i} className={classNames.join(' ')} data-sentence-active={active || undefined}>
            {sentence.text}{' '}
          </span>
        );
      })}
    </>
  );
}

const READABLE_TYPES = new Set<Block['type']>(['heading', 'paragraph', 'quote', 'callout', 'list']);

export function NarrationHighlightRenderer({ blocks, theme, activeSentenceText }: NarrationHighlightRendererProps) {
  return (
    <div className={theme.classes.container}>
      {blocks.map((block, i) => {
        if (!READABLE_TYPES.has(block.type)) {
          // image/table/code/hr : jamais lus, jamais surlignés — rendu inchangé, aucune logique dupliquée.
          return <MarkdownRenderer key={i} blocks={[block]} theme={theme} />;
        }

        switch (block.type) {
          case 'heading': {
            const tag = `h${Math.min(Math.max(block.depth, 1), 6)}`;
            const className = block.depth === 1 ? theme.classes.heading1 : block.depth === 2 ? theme.classes.heading2 : theme.classes.heading3;
            return React.createElement(
              tag,
              { key: i, id: block.anchor || undefined, className },
              <HighlightedSentences text={stripHtml(block.html) || block.text} activeSentenceText={activeSentenceText} />,
            );
          }
          case 'paragraph':
            return (
              <p key={i} className={theme.classes.paragraph}>
                <HighlightedSentences text={stripHtml(block.html)} activeSentenceText={activeSentenceText} />
              </p>
            );
          case 'quote':
            return (
              <blockquote key={i} className={theme.classes.quote}>
                <HighlightedSentences text={stripHtml(block.html)} activeSentenceText={activeSentenceText} forceDialogue />
              </blockquote>
            );
          case 'callout': {
            const Icon = CALLOUT_ICONS[block.kind];
            const label = block.title || theme.calloutLabels?.[block.kind] || CALLOUT_LABELS[block.kind];
            return (
              <div key={i} className={`${theme.classes.callout} ${theme.classes.callout}--${block.kind}`}>
                <div className={`${theme.classes.callout}-header`}>
                  <Icon size={18} />
                  <strong>{label}</strong>
                </div>
                <div><HighlightedSentences text={stripHtml(block.html)} activeSentenceText={activeSentenceText} /></div>
              </div>
            );
          }
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} className={theme.classes.list}>
                {block.items.map((item, j) => (
                  <li key={j}><HighlightedSentences text={stripHtml(item)} activeSentenceText={activeSentenceText} /></li>
                ))}
              </Tag>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
