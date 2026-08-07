import '../../modules/portals/markdown-kids-theme.css';
import type { MarkdownTheme } from '../MarkdownTheme';

/**
 * Univers graphique enfant — grosses bulles colorées, illustrations généreuses,
 * typographie très lisible. Scopé par `.portal-kids` (déjà posé par
 * PortalDetailPage.jsx) et les tokens --portal-* de portal-brand-theme.css.
 * Même Markdown, même MarkdownRenderer que Discover/Sports.
 */
export const KidsTheme: MarkdownTheme = {
  id: 'kids',
  label: 'Kids',
  showImageCaption: true,
  calloutLabels: { tip: 'Le sais-tu ?', info: 'Info', warning: 'Attention', note: 'À retenir' },
  classes: {
    container: 'md-kids',
    heading1: 'md-kids-h1',
    heading2: 'md-kids-h2',
    heading3: 'md-kids-h3',
    paragraph: 'md-kids-p',
    image: 'md-kids-figure',
    table: 'md-kids-table',
    tableWrapper: 'md-kids-table-wrapper',
    quote: 'md-kids-quote',
    callout: 'md-kids-callout',
    code: 'md-kids-code',
    list: 'md-kids-list',
    faq: 'md-kids-faq',
  },
};
