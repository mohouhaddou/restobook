/**
 * Adapte les blocs déjà parsés reçus de l'API (backend/src/shared/markdown/markdownEngine.js,
 * `marked.lexer` sous le capot) vers le type `Block` attendu par MarkdownRenderer.
 *
 * Il n'y a AUCUNE logique de parsing Markdown ici — le Markdown est déjà transformé
 * en JSON structuré côté serveur. Ce module ne fait que typer/valider défensivement
 * cette entrée, pour ne jamais planter le rendu sur une réponse API inattendue.
 */

export type CalloutKind = 'tip' | 'info' | 'warning' | 'note';

export interface HeadingBlock { readonly type: 'heading'; readonly depth: number; readonly text: string; readonly html: string; readonly anchor: string; }
export interface ParagraphBlock { readonly type: 'paragraph'; readonly html: string; }
export interface ImageBlock { readonly type: 'image'; readonly src: string; readonly alt: string; readonly title: string | null; }
export interface TableBlock { readonly type: 'table'; readonly align: readonly (string | null)[]; readonly header: readonly string[]; readonly rows: readonly (readonly string[])[]; }
export interface QuoteBlock { readonly type: 'quote'; readonly html: string; }
export interface CalloutBlock { readonly type: 'callout'; readonly kind: CalloutKind; readonly title: string | null; readonly html: string; }
export interface CodeBlock { readonly type: 'code'; readonly lang: string | null; readonly text: string; }
export interface ListBlock { readonly type: 'list'; readonly ordered: boolean; readonly items: readonly string[]; }
export interface HrBlock { readonly type: 'hr'; }

export type Block =
  | HeadingBlock | ParagraphBlock | ImageBlock | TableBlock
  | QuoteBlock | CalloutBlock | CodeBlock | ListBlock | HrBlock;

export interface TocItem { readonly level: number; readonly text: string; readonly anchor: string; }
export interface FaqItem { readonly question: string; readonly answer: string; }

const KNOWN_CALLOUT_KINDS: readonly CalloutKind[] = ['tip', 'info', 'warning', 'note'];
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function normalizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  switch (b.type) {
    case 'heading':
      return { type: 'heading', depth: Number(b.depth) || 2, text: str(b.text), html: str(b.html, str(b.text)), anchor: str(b.anchor) };
    case 'paragraph':
      return { type: 'paragraph', html: str(b.html) };
    case 'image':
      return { type: 'image', src: str(b.src), alt: str(b.alt), title: typeof b.title === 'string' ? b.title : null };
    case 'table':
      return {
        type: 'table',
        align: Array.isArray(b.align) ? (b.align as (string | null)[]) : [],
        header: Array.isArray(b.header) ? b.header.map(c => str(c)) : [],
        rows: Array.isArray(b.rows) ? b.rows.map(row => (Array.isArray(row) ? row.map(c => str(c)) : [])) : [],
      };
    case 'quote':
      return { type: 'quote', html: str(b.html) };
    case 'callout':
      return {
        type: 'callout',
        kind: KNOWN_CALLOUT_KINDS.includes(b.kind as CalloutKind) ? (b.kind as CalloutKind) : 'info',
        title: typeof b.title === 'string' ? b.title : null,
        html: str(b.html),
      };
    case 'code':
      return { type: 'code', lang: typeof b.lang === 'string' ? b.lang : null, text: str(b.text) };
    case 'list':
      return { type: 'list', ordered: Boolean(b.ordered), items: Array.isArray(b.items) ? b.items.map(i => str(i)) : [] };
    case 'hr':
      return { type: 'hr' };
    default:
      return null;
  }
}

/** Normalise un tableau de blocs bruts (réponse API) — tout bloc de type inconnu est ignoré, jamais fatal. */
export function parseMarkdownBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeBlock).filter((b): b is Block => b !== null);
}

export function parseToc(raw: unknown): TocItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === 'object')
    .map(t => ({ level: Number(t.level) || 2, text: str(t.text), anchor: str(t.anchor) }));
}

export function parseFaq(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === 'object')
    .map(f => ({ question: str(f.question), answer: str(f.answer) }))
    .filter(f => f.question && f.answer);
}
