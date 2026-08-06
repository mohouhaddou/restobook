import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Block, ImageBlock } from '../../../../shared/markdown/MarkdownParser';
import type { MarkdownTheme } from '../../../../shared/markdown/MarkdownTheme';
import { MarkdownRenderer } from '../../../../shared/markdown/MarkdownRenderer';
import type { StoryLayoutBox } from './StoryLayoutEngine';
import { shouldForceNewPageBefore } from './ChapterLayoutManager';
import { stripHtml } from './narration/SpeechExtractor';

/** Part de la hauteur totale occupée par l'illustration en mode PORTRAIT (empilé, image en haut) —
 * en mode PAYSAGE (spread), image et texte se partagent la LARGEUR, jamais la hauteur : le texte y
 * dispose donc de 100% de la hauteur de page, voir `textZoneHeight`. DOIT rester cohérente avec
 * `.scene--column .scene-image` dans storybook.css. */
export const PORTRAIT_IMAGE_HEIGHT_RATIO = 0.44;

/** Classe partagée par le texte réellement affiché (`.scene-text-inner`, ScenePage.tsx) ET le
 * conteneur du mesureur hors-écran ci-dessous : la typographie du livre (storybook.css) est scopée
 * via cette classe — si elle n'était posée QUE sur le rendu réel, le mesureur measurerait avec une
 * police/un interligne différents (ceux, génériques, du thème Kids) et sous-estimerait la hauteur
 * réelle une fois affichée (piège déjà rencontré dans ce chantier). */
export const SCENE_TEXT_CLASS = 'scene-text-inner';

/** Marges généreuses autour du texte (jamais autour de l'illustration, qui reste toujours à 100%
 * de sa zone) — en proportion de la zone de texte elle-même, doivent rester cohérentes avec
 * storybook.css (`.scene-text`). */
export const TEXT_PADDING_X_RATIO = 0.09;
export const TEXT_PADDING_Y_RATIO = 0.08;

/** Largeur de lecture confortable (60-70 caractères) : le texte ne s'étire jamais sur toute la
 * largeur d'un grand écran, même en paysage — doit rester cohérente avec `.scene-text-inner` dans
 * storybook.css (`max-width`), sous peine de mesurer une largeur plus généreuse que celle
 * réellement rendue (texte mesuré comme tenant qui déborderait une fois affiché). */
export const TEXT_MAX_WIDTH_PX = 720;

export type PageKind = 'cover' | 'scene';

export interface PaginatedPage {
  /** Texte de cet écran — jamais l'illustration (voir `image`). Une page de couverture n'a pas de
   * blocs : son titre/sous-titre viennent de `title`/`subtitle`, superposés sur l'image. */
  readonly blocks: readonly Block[];
  /** L'illustration affichée sur cet écran — persiste naturellement à travers toutes les pages de
   * texte issues du même "segment" (voir `splitIntoSegments`) jusqu'à la prochaine image
   * rencontrée dans le flux : aucune page n'est jamais sans illustration. */
  readonly image: ImageBlock | null;
  readonly kind: PageKind;
  /** true si cette page commence un nouveau chapitre (son premier bloc est un titre) — pilote le
   * traitement typographique "titre de chapitre" dans ScenePage.tsx. */
  readonly isChapterStart: boolean;
  /** Couverture uniquement. */
  readonly title?: string;
  readonly subtitle?: string | null;
}

const EMPTY_PAGE: PaginatedPage = { blocks: [], image: null, kind: 'scene', isChapterStart: false };

/** Hauteur de la zone de texte AVANT padding : en paysage, image et texte se partagent la LARGEUR
 * (le texte a toute la hauteur) ; en portrait, ils se partagent la HAUTEUR (image en haut). */
function textZoneHeight(layout: StoryLayoutBox): number {
  return layout.mode === 'single' ? layout.pageHeight * (1 - PORTRAIT_IMAGE_HEIGHT_RATIO) : layout.pageHeight;
}

function textContentBox(layout: StoryLayoutBox) {
  const outerWidth = layout.pageWidth;
  const outerHeight = textZoneHeight(layout);
  const paddingX = outerWidth * TEXT_PADDING_X_RATIO;
  const paddingY = outerHeight * TEXT_PADDING_Y_RATIO;
  return {
    width: Math.max(0, Math.min(outerWidth - 2 * paddingX, TEXT_MAX_WIDTH_PX)),
    height: Math.max(0, outerHeight - 2 * paddingY),
  };
}

/** Padding réel (px) à poser en style inline sur `.scene-text` (ScenePage.tsx) — calculé à partir
 * des MÊMES ratios que `textContentBox` ci-dessus, pour que le budget de hauteur/largeur de la
 * pagination corresponde EXACTEMENT au rendu réel. Un padding-top/bottom en % CSS se résout contre
 * la LARGEUR du bloc conteneur, jamais sa hauteur (spec CSS standard) — piège déjà rencontré dans
 * ce chantier, d'où ce calcul en JS plutôt qu'en pourcentages CSS. */
export function textZonePaddingFor(layout: StoryLayoutBox): { paddingX: number; paddingY: number } {
  const outerHeight = textZoneHeight(layout);
  return {
    paddingX: layout.pageWidth * TEXT_PADDING_X_RATIO,
    paddingY: outerHeight * TEXT_PADDING_Y_RATIO,
  };
}

/** Mesureur hors-écran : rend les VRAIS composants (MarkdownRenderer/MarkdownComponents) dans un
 * conteneur invisible pour lire leur hauteur réelle — jamais d'estimation par comptage de
 * caractères, jamais de logique de rendu dupliquée (mêmes composants que l'affichage réel).
 *
 * Inséré comme DESCENDANT de `parentEl` (le cadre lecteur réel), pas dans `document.body` : les
 * classes de thème (ex. KidsTheme) ne stylent leurs éléments qu'à condition d'un ancêtre
 * `.portal-kids` — un mesureur posé à la racine du document ne recevrait pas ces styles et
 * mesurerait une hauteur plus petite que celle réellement affichée (police/marges par défaut au
 * lieu de celles du thème), sous-estimant silencieusement le contenu qui déborderait ensuite.
 * `position: fixed` le sort du flux normal sans le sortir de l'arbre DOM (donc sans casser la
 * cascade CSS basée sur les ancêtres).
 */
function createMeasurer(parentEl: HTMLElement) {
  const container = document.createElement('div');
  // Même classe que le texte réellement affiché (voir SCENE_TEXT_CLASS) : la typographie du livre
  // (storybook.css) doit s'appliquer IDENTIQUEMENT ici pendant la mesure.
  container.className = SCENE_TEXT_CLASS;
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-99999px';
  container.style.visibility = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  parentEl.appendChild(container);
  const root = createRoot(container);
  return {
    container,
    setWidth(width: number, fontScale: number) {
      container.style.width = `${Math.max(1, width)}px`;
      container.style.setProperty('--story-font-scale', String(fontScale));
    },
    measure(blocks: readonly Block[], theme: MarkdownTheme): number {
      if (!blocks.length) return 0;
      flushSync(() => {
        root.render(React.createElement(MarkdownRenderer, { blocks: blocks as Block[], theme }));
      });
      return container.scrollHeight;
    },
    destroy() {
      root.unmount();
      container.remove();
    },
  };
}

interface Segment {
  readonly image: ImageBlock | null;
  readonly blocks: Block[];
}

/** Un `heading` (titre) ou un `hr` (séparateur) ne doit jamais rester seul, isolé du texte qui le
 * suit vraiment — que ce soit à l'intérieur d'un segment (voir `paginateSegmentText`) ou À LA
 * JONCTURE entre deux segments (voir `splitIntoSegments` ci-dessous). */
function isOrphanProne(block: Block): boolean {
  return block.type === 'heading' || block.type === 'hr';
}

/** Découpe le flux de blocs en segments ancrés sur les illustrations : chaque image ouvre un
 * nouveau segment et devient SON illustration — persistante pour tout le texte qui suit, jusqu'à
 * la prochaine image. `initialImage` (l'illustration de COUVERTURE, voir `extractCover`) amorce le
 * tout premier segment : la couverture ne fait pas partie de `blocks` ici, mais son image doit
 * continuer à persister sur les toutes premières scènes tant qu'aucune NOUVELLE image n'apparaît
 * dans le corps — sans ça, la règle "aucune page sans illustration" serait violée dès la première
 * scène d'une histoire qui n'a qu'une image de couverture (bug constaté en vérification live).
 *
 * Un titre de chapitre (ou un `hr`) qui se retrouve en TOUTE FIN d'un segment, juste avant que la
 * PROCHAINE image n'arrive, appartient visuellement à cette prochaine illustration — pas à
 * l'ancienne : il est donc reporté en tête du segment SUIVANT plutôt que laissé seul à la fin de
 * celui qui se ferme. Sans ce report, l'anti-orphelin de `paginateSegmentText` (qui ne voit chaque
 * segment qu'isolément) ne pouvait pas empêcher un titre de chapitre de se retrouver seul sur son
 * écran juste parce qu'une illustration arrivait juste après lui (bug constaté en vérification
 * live : "Chapitre 1 — ..." affiché seul, son texte ne commençant qu'à l'écran suivant). */
function splitIntoSegments(blocks: readonly Block[], initialImage: ImageBlock | null = null): Segment[] {
  const segments: Segment[] = [];
  let currentImage: ImageBlock | null = initialImage;
  let currentBlocks: Block[] = [];
  let started = false;
  for (const block of blocks) {
    if (block.type === 'image') {
      if (started) {
        const carryToNext: Block[] = [];
        while (currentBlocks.length > 0 && isOrphanProne(currentBlocks[currentBlocks.length - 1])) {
          carryToNext.unshift(currentBlocks.pop() as Block);
        }
        segments.push({ image: currentImage, blocks: currentBlocks });
        currentBlocks = carryToNext;
      }
      currentImage = block;
      started = true;
    } else {
      currentBlocks.push(block);
      started = true;
    }
  }
  if (started) segments.push({ image: currentImage, blocks: currentBlocks });
  return segments;
}

/** Pagine le texte d'UN segment en écrans successifs qui tiennent dans `contentHeight` — jamais de
 * coupure au milieu d'un bloc, jamais de vol de budget par l'illustration (elle occupe sa PROPRE
 * zone à 100%, indépendante de la hauteur de texte disponible). Un chapitre force toujours un
 * nouvel écran (voir ChapterLayoutManager) ; son titre n'y reste jamais seul (report avec la
 * suite), sauf en toute fin d'histoire — cas limite accepté. */
function paginateSegmentText(blocks: readonly Block[], contentHeight: number, measureText: (blocks: readonly Block[]) => number): Block[][] {
  if (!blocks.length) return [[]];
  const pages: Block[][] = [];
  let current: Block[] = [];

  const closeCurrent = (): Block[] => {
    const carryOver: Block[] = [];
    while (current.length > 0 && isOrphanProne(current[current.length - 1])) {
      carryOver.unshift(current.pop() as Block);
    }
    if (current.length) pages.push(current);
    current = [];
    return carryOver;
  };

  for (const block of blocks) {
    if (shouldForceNewPageBefore(block, current.length > 0)) {
      current = closeCurrent();
    }
    const tentative = [...current, block];
    const height = measureText(tentative);
    if (current.length === 0 || height <= contentHeight) {
      current = tentative;
    } else {
      const carryOver = closeCurrent();
      current = [...carryOver, block];
    }
  }
  const finalCarryOver = closeCurrent();
  if (finalCarryOver.length) pages.push(finalCarryOver);
  return pages.length ? pages : [[]];
}

/** Exportée pour être testée directement avec un `measureText` factice (sans DOM réel). Ne
 * s'occupe jamais de la couverture (voir `extractCover`) — uniquement des scènes (illustration +
 * texte qui persiste jusqu'à la prochaine illustration). */
export function paginateBlocks(
  blocks: readonly Block[],
  layout: StoryLayoutBox,
  fontScale: number,
  measureText: (blocks: readonly Block[]) => number,
  initialImage: ImageBlock | null = null,
): PaginatedPage[] {
  if (!blocks.length || layout.width === 0) return [EMPTY_PAGE];
  const { height: contentHeight } = textContentBox(layout);
  const segments = splitIntoSegments(blocks, initialImage);
  const pages: PaginatedPage[] = [];
  for (const segment of segments) {
    const textPages = paginateSegmentText(segment.blocks, contentHeight, measureText);
    for (const textPage of textPages) {
      pages.push({
        blocks: textPage,
        image: segment.image,
        kind: 'scene',
        isChapterStart: textPage.length > 0 && textPage[0].type === 'heading',
      });
    }
  }
  return pages.length ? pages : [EMPTY_PAGE];
}

export interface CoverExtraction {
  readonly cover: PaginatedPage;
  readonly bodyBlocks: readonly Block[];
}

/** Sépare la vraie COUVERTURE (image pleine page + titre + sous-titre superposés, voir
 * CoverPage.tsx) du reste de l'histoire, qui seul est paginé en scènes. Le titre du livre (depth 1)
 * et un éventuel court paragraphe d'accroche juste après (retenu comme sous-titre s'il tient en une
 * ligne, ≤140 caractères) ne sont JAMAIS dupliqués dans la première scène — la couverture les
 * consomme entièrement.
 */
export function extractCover(blocks: readonly Block[], coverImage: string | undefined, title: string | undefined): CoverExtraction {
  const startsWithImage = blocks[0]?.type === 'image';
  const coverImg: ImageBlock = startsWithImage
    ? (blocks[0] as ImageBlock)
    : { type: 'image', src: coverImage ?? '', alt: title ?? '', title: null };
  let rest = startsWithImage ? blocks.slice(1) : blocks.slice();

  let bookTitle = title ?? '';
  let subtitle: string | null = null;
  const firstBlock = rest[0];
  if (firstBlock?.type === 'heading' && firstBlock.depth === 1) {
    bookTitle = firstBlock.text || bookTitle;
    rest = rest.slice(1);
    const maybeSubtitle = rest[0];
    if (maybeSubtitle?.type === 'paragraph') {
      const text = stripHtml(maybeSubtitle.html);
      if (text && text.length <= 140) {
        subtitle = text;
        rest = rest.slice(1);
      }
    }
  }

  return {
    cover: { blocks: [], image: coverImg, kind: 'cover', isChapterStart: false, title: bookTitle, subtitle },
    bodyBlocks: rest,
  };
}

export interface StoryPagination {
  readonly pages: readonly PaginatedPage[];
  /** false pendant la toute première mesure — évite un flash de pagination erronée. */
  readonly ready: boolean;
}

/**
 * Pagine `blocks` selon le layout résolu par StoryLayoutEngine. Jamais de coupure au milieu d'un
 * bloc (un paragraphe/une liste/une citation/un dialogue = un bloc = jamais scindé) : la
 * granularité de pagination est le bloc, pas le caractère. La toute première page est TOUJOURS la
 * couverture (voir `extractCover`), suivie des scènes.
 */
export function useStoryPagination(
  blocks: readonly Block[],
  layout: StoryLayoutBox,
  theme: MarkdownTheme,
  fontScale = 1,
  measurerParent: HTMLElement | null = null,
  coverImage?: string,
  title?: string,
): StoryPagination {
  const measurerRef = useRef<ReturnType<typeof createMeasurer> | null>(null);
  const [scenePages, setScenePages] = useState<readonly PaginatedPage[]>([]);
  const [ready, setReady] = useState(false);

  const { cover, bodyBlocks } = useMemo(() => extractCover(blocks, coverImage, title), [blocks, coverImage, title]);

  useEffect(() => {
    if (!measurerParent) return undefined;
    measurerRef.current = createMeasurer(measurerParent);
    return () => measurerRef.current?.destroy();
  }, [measurerParent]);

  useEffect(() => {
    const measurer = measurerRef.current;
    if (!measurer || layout.width === 0) return undefined;
    // Différé hors du cycle de commit React courant : `flushSync` (utilisé par le mesureur pour
    // lire une hauteur réelle immédiatement) ne peut pas être appelé pendant que React traite déjà
    // les effets de ce même rendu — voir https://react.dev/reference/react-dom/flushSync. Le
    // report en macro-tâche a aussi pour effet de débouncer les recalculs en rafale (resize).
    const timer = setTimeout(() => {
      const { width: contentWidth } = textContentBox(layout);
      measurer.setWidth(contentWidth, fontScale);
      const result = paginateBlocks(bodyBlocks, layout, fontScale, b => measurer.measure(b, theme), cover.image);
      setScenePages(result);
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyBlocks, layout.mode, layout.pageWidth, layout.pageHeight, theme, fontScale]);

  const pages = useMemo(() => [cover, ...scenePages], [cover, scenePages]);
  return { pages, ready };
}
