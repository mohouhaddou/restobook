import '../../../modules/portals/markdown-sports-theme.css';
import type { MarkdownTheme } from '../MarkdownTheme';

/**
 * Thème Sports — palette et cartes premium, scopé par `.portal-sports` (déjà
 * posé par PortalDetailPage.jsx) et par les tokens --portal-* existants
 * (portal-brand-theme.css). Même Markdown, même MarkdownRenderer que Discover ;
 * seule cette feuille de style change.
 */
export const SportsTheme: MarkdownTheme = {
  id: 'sports',
  label: 'Sports',
  showImageCaption: true,
  calloutLabels: { tip: 'Conseil', info: 'Info', warning: 'Attention', note: 'À retenir' },
  classes: {
    container: 'md-sports',
    heading1: 'md-sports-h1',
    heading2: 'md-sports-h2',
    heading3: 'md-sports-h3',
    paragraph: 'md-sports-p',
    image: 'md-sports-figure',
    table: 'md-sports-table',
    tableWrapper: 'md-sports-table-wrapper',
    quote: 'md-sports-quote',
    callout: 'md-sports-callout',
    code: 'md-sports-code',
    list: 'md-sports-list',
    faq: 'md-sports-faq',
  },
};
