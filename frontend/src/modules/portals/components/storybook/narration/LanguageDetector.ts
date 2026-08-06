/**
 * Détecte la langue d'une histoire à partir de son propre TEXTE — jamais de la langue de
 * l'interface (site UI) : le contenu n'est pas forcément traduit dans chaque langue affichée par
 * le site (ex. une Story écrite en français reste en français même si l'utilisateur navigue le
 * site en anglais), donc seule la langue réelle du texte doit piloter le choix du narrateur.
 */
import type { Block } from '../../../../../shared/markdown/MarkdownParser';
import type { NarrationLanguage } from '../NarrationBar';

const ARABIC_SCRIPT_RE = /[؀-ۿ]/;

/** Quelques marqueurs très fréquents et peu ambigus de chaque langue — un texte court (titre +
 * premiers paragraphes) suffit largement à trancher, pas besoin d'une vraie bibliothèque de
 * détection de langue pour deux langues aussi différentes que le français et l'anglais. */
const FRENCH_MARKERS = /[éèàùâêîôûëïüçœ]|\b(le|la|les|des|une|un|et|du|dans|avec|pour|sur|qui|que|ce|cette|est|sont|il|elle|nous|vous|ils|elles)\b/gi;
const ENGLISH_MARKERS = /\b(the|and|is|of|in|to|a|that|this|are|he|she|we|you|they|with|for|on|was|were)\b/gi;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

function sampleText(blocks: readonly Block[], maxChars = 600): string {
  const parts: string[] = [];
  let length = 0;
  for (const block of blocks) {
    let text = '';
    if (block.type === 'heading' || block.type === 'paragraph' || block.type === 'quote') text = stripHtml(block.html);
    else if (block.type === 'callout') text = stripHtml(block.html);
    else if (block.type === 'list') text = block.items.map(stripHtml).join(' ');
    if (!text) continue;
    parts.push(text);
    length += text.length;
    if (length >= maxChars) break;
  }
  return parts.join(' ');
}

/** Analyse le texte réel de l'histoire (titre + premiers blocs lisibles) — jamais la langue de
 * l'UI. Arabe détecté par son script (fiable à 100%) ; français/anglais départagés par fréquence
 * de marqueurs très courants. Par défaut 'fr' à égalité (contenu majoritairement francophone). */
export function detectStoryLanguage(blocks: readonly Block[]): NarrationLanguage {
  const text = sampleText(blocks);
  if (!text.trim()) return 'fr';
  if (ARABIC_SCRIPT_RE.test(text)) return 'ar';

  const frenchScore = (text.match(FRENCH_MARKERS) || []).length;
  const englishScore = (text.match(ENGLISH_MARKERS) || []).length;
  return englishScore > frenchScore ? 'en' : 'fr';
}
