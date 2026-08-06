import './discover-markdown-theme.css';
import type { MarkdownTheme } from '../MarkdownTheme';

/**
 * Thème de référence. `container`/heading/paragraph/image/quote/list réutilisent
 * EXACTEMENT les classes historiques `.ifm-body` (frontend/index.html) — le rendu
 * visuel de Discover ne change pas. Seuls table/callout/code, qui n'avaient
 * jamais eu de style, reçoivent une présentation additive sobre.
 */
export const DiscoverTheme: MarkdownTheme = {
  id: 'discover',
  label: 'Discover',
  showImageCaption: false,
  classes: {
    container: 'ifm-body',
    heading1: '',
    heading2: '',
    heading3: '',
    paragraph: '',
    image: 'ifm-body-figure',
    table: 'ifm-body-table',
    tableWrapper: 'ifm-body-table-wrapper',
    quote: '',
    callout: 'ifm-body-callout',
    code: 'ifm-body-code',
    list: '',
    faq: 'ifm-faq',
  },
};
