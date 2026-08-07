import { describe, it, expect } from 'vitest';
import { paginateBlocks, extractCover } from '../StoryPaginator';
import type { StoryLayoutBox } from '../StoryLayoutEngine';
import type { Block, ImageBlock } from '../../../../../markdown/MarkdownParser';

const HEIGHT_PER_BLOCK = 40;
/** measureText factice et déterministe (pas de vrai DOM) : chaque bloc texte "pèse" 40px. */
const fakeMeasure = (blocks: readonly Block[]) => blocks.length * HEIGHT_PER_BLOCK;

function paragraph(id: string): Block { return { type: 'paragraph', html: `<p>${id}</p>` }; }
function image(src: string): ImageBlock { return { type: 'image', src, alt: '', title: null }; }
function heading(text: string, depth = 2): Block { return { type: 'heading', depth, text, html: text, anchor: text }; }

function spreadLayout(pageHeight: number, pageWidth = 400, direction: 'ltr' | 'rtl' = 'ltr'): StoryLayoutBox {
  return { mode: 'spread', columns: 2, width: pageWidth * 2, height: pageHeight, pageWidth, pageHeight, direction };
}
function singleLayout(pageHeight: number, pageWidth = 400, direction: 'ltr' | 'rtl' = 'ltr'): StoryLayoutBox {
  return { mode: 'single', columns: 1, width: pageWidth, height: pageHeight, pageWidth, pageHeight, direction };
}

describe('paginateBlocks', () => {
  it('ne coupe jamais un bloc : chaque bloc source apparaît exactement une fois, dans l’ordre', () => {
    const blocks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(paragraph);
    const layout = singleLayout(200); // portrait : zone de texte réduite (56% de 200, moins padding) — force plusieurs écrans
    const pages = paginateBlocks(blocks, layout, 1, fakeMeasure);
    const flattened = pages.flatMap(p => p.blocks);
    expect(flattened).toHaveLength(blocks.length);
    expect(flattened.map(b => (b as { html: string }).html)).toEqual(blocks.map(b => (b as { html: string }).html));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every(p => p.blocks.length > 0)).toBe(true);
  });

  it('une image ouvre un nouveau segment et devient SON illustration, persistante sur toutes les pages de texte qui suivent', () => {
    const blocks: Block[] = [
      image('A.webp'), ...Array.from({ length: 8 }, (_, i) => paragraph(`a${i}`)),
      image('B.webp'), paragraph('b0'),
    ];
    const pages = paginateBlocks(blocks, spreadLayout(300), 1, fakeMeasure);
    const withA = pages.filter(p => p.blocks.some(b => (b as { html?: string }).html?.startsWith('<p>a')));
    const withB = pages.filter(p => p.blocks.some(b => (b as { html?: string }).html === '<p>b0</p>'));
    expect(withA.length).toBeGreaterThan(1); // 8 paragraphes ne tiennent pas sur un seul écran ⇒ plusieurs pages
    expect(withA.every(p => p.image?.src === 'A.webp')).toBe(true);
    expect(withB.every(p => p.image?.src === 'B.webp')).toBe(true);
  });

  it('aucune page n’est jamais sans illustration une fois qu’une image est apparue dans le flux', () => {
    const blocks: Block[] = [image('A.webp'), ...Array.from({ length: 12 }, (_, i) => paragraph(`p${i}`))];
    const pages = paginateBlocks(blocks, singleLayout(250), 1, fakeMeasure);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every(p => p.image !== null)).toBe(true);
  });

  it('l’image de COUVERTURE (initialImage) persiste sur les premières scènes tant qu’aucune nouvelle image n’apparaît dans le corps', () => {
    // Bug constaté en vérification live : une histoire dont l'unique image est la couverture (donc
    // absente de `blocks`, qui ne contient que le corps) affichait ses toutes premières scènes SANS
    // aucune illustration — la couverture ne "persistait" pas au-delà d'elle-même.
    const blocks: Block[] = [paragraph('p1'), paragraph('p2')]; // aucune image dans le corps
    const coverImage = image('cover.webp');
    const pages = paginateBlocks(blocks, singleLayout(1200), 1, fakeMeasure, coverImage);
    expect(pages.every(p => p.image?.src === 'cover.webp')).toBe(true);
  });

  it('ne renvoie jamais un tableau de pages vide, même sans blocs', () => {
    const pages = paginateBlocks([], singleLayout(600), 1, fakeMeasure);
    expect(pages).toHaveLength(1);
    expect(pages[0].blocks).toEqual([]);
  });

  it('un chapitre force TOUJOURS un nouvel écran, même s’il tiendrait techniquement à la suite du contenu précédent', () => {
    // Page assez grande (400px) pour que tout tiendrait sur un seul écran sans la règle de saut forcé.
    const blocks: Block[] = [image('A.webp'), paragraph('p1'), heading('Chapitre 2'), paragraph('suite')];
    const pages = paginateBlocks(blocks, singleLayout(1200), 1, fakeMeasure);
    const chapterPageIndex = pages.findIndex(p => p.isChapterStart);
    expect(chapterPageIndex).toBeGreaterThan(0); // jamais sur le même écran que "p1"
    expect(pages[chapterPageIndex].blocks[0].type).toBe('heading');
    expect(pages.flatMap(p => p.blocks)).toHaveLength(3); // p1, Chapitre 2, suite (l'image n'est pas un bloc de blocks)
  });

  it('un titre de chapitre ne reste jamais seul en bas d’écran : il est reporté avec la suite', () => {
    // contentHeight ≈ 200*(1-2*0.08) = 168 (spread, pas de partage portrait) : 4 blocs (160px) tiennent
    // tout juste, un titre en 5ᵉ position tient aussi seul, mais son paragraphe (6ᵉ) déborderait.
    const blocks: Block[] = [
      image('A.webp'),
      paragraph('p1'), paragraph('p2'), paragraph('p3'), paragraph('p4'),
      heading('Chapitre 2'),
      paragraph('suite du chapitre 2'),
    ];
    const pages = paginateBlocks(blocks, spreadLayout(200), 1, fakeMeasure);
    const titlePageIndex = pages.findIndex(p => p.blocks.some(b => b.type === 'heading'));
    expect(titlePageIndex).toBeGreaterThanOrEqual(0);
    const titlePage = pages[titlePageIndex].blocks;
    expect(titlePage[titlePage.length - 1].type).not.toBe('heading');
    expect(titlePage.some(b => b.type === 'paragraph' && (b as { html: string }).html.includes('suite du chapitre 2'))).toBe(true);
  });

  it('un titre en toute fin d’histoire (rien après) reste seul — cas limite accepté', () => {
    const blocks: Block[] = [image('A.webp'), paragraph('p1'), paragraph('p2'), paragraph('p3'), paragraph('p4'), heading('Fin')];
    const pages = paginateBlocks(blocks, spreadLayout(200), 1, fakeMeasure);
    expect(pages.some(p => p.blocks.length === 1 && p.blocks[0].type === 'heading')).toBe(true);
  });

  it('un séparateur `hr` isolé juste avant un titre de chapitre n’est jamais laissé seul sur sa page : reporté avec le titre', () => {
    // Bug constaté en vérification live : un `<hr>` décoratif placé juste avant un titre de
    // chapitre (qui force un saut de page) se retrouvait seul sur un écran presque vide — le
    // report anti-orphelin ne concernait jusque-là que les titres, pas les séparateurs.
    const blocks: Block[] = [
      image('A.webp'),
      paragraph('p1'), paragraph('p2'), paragraph('p3'), paragraph('p4'),
      { type: 'hr' }, heading('Chapitre 2'), paragraph('suite'),
    ];
    const pages = paginateBlocks(blocks, spreadLayout(200), 1, fakeMeasure);
    const hrPageIndex = pages.findIndex(p => p.blocks.some(b => b.type === 'hr'));
    expect(hrPageIndex).toBeGreaterThanOrEqual(0);
    const hrPage = pages[hrPageIndex].blocks;
    expect(hrPage.length).toBeGreaterThan(1); // jamais seul
    expect(hrPage.some(b => b.type === 'heading')).toBe(true);
  });

  it('un titre de chapitre juste avant une NOUVELLE image n’est jamais laissé seul : reporté sur l’écran de cette image, avec le début de son texte', () => {
    // Bug constaté en vérification live : "Chapitre 1 — ..." s'affichait seul (texte vide), le
    // texte du chapitre ne commençant qu'à l'écran suivant — parce que le titre terminait un
    // SEGMENT (juste avant l'arrivée d'une nouvelle image) et que l'anti-orphelin, purement interne
    // à un segment, ne voyait pas venir cette jonction.
    const blocks: Block[] = [
      image('A.webp'), paragraph('p1'),
      heading('Chapitre 1'),
      image('B.webp'), paragraph('texte du chapitre 1'),
    ];
    const pages = paginateBlocks(blocks, spreadLayout(1200), 1, fakeMeasure);
    const chapterPage = pages.find(p => p.isChapterStart)!;
    expect(chapterPage).toBeDefined();
    expect(chapterPage.blocks.length).toBeGreaterThan(1); // jamais seul avec juste son titre
    expect(chapterPage.image?.src).toBe('B.webp'); // partage l'écran avec la NOUVELLE illustration
    expect(pages.flatMap(p => p.blocks)).toHaveLength(3); // p1, Chapitre 1, texte du chapitre 1
  });

  it('isChapterStart : vrai seulement pour l’écran dont le PREMIER bloc est un titre', () => {
    const blocks: Block[] = [image('A.webp'), paragraph('avant'), heading('Chapitre 1'), paragraph('texte')];
    const pages = paginateBlocks(blocks, singleLayout(1200), 1, fakeMeasure);
    expect(pages.filter(p => p.isChapterStart)).toHaveLength(1);
    const chapterPage = pages.find(p => p.isChapterStart)!;
    expect(chapterPage.blocks[0].type).toBe('heading');
  });
});

describe('extractCover', () => {
  it('extrait la couverture (image + titre h1 + court sous-titre) et ne les duplique jamais dans le corps', () => {
    const blocks: Block[] = [
      image('cover.webp'),
      heading('Le Secret des Sourires', 1),
      paragraph('Une histoire pour les petits curieux.'),
      heading('Chapitre 1', 2),
      paragraph('Il était une fois...'),
    ];
    const { cover, bodyBlocks } = extractCover(blocks, undefined, undefined);
    expect(cover.kind).toBe('cover');
    expect(cover.image?.src).toBe('cover.webp');
    expect(cover.title).toBe('Le Secret des Sourires');
    expect(cover.subtitle).toBe('Une histoire pour les petits curieux.');
    expect(cover.blocks).toEqual([]);
    // Ni le titre ni le sous-titre ne réapparaissent dans le corps de l'histoire.
    expect(bodyBlocks.some(b => b.type === 'heading' && b.depth === 1)).toBe(false);
    expect(bodyBlocks.some(b => b.type === 'paragraph' && (b as { html: string }).html.includes('petits curieux'))).toBe(false);
    expect(bodyBlocks[0]).toEqual(heading('Chapitre 1', 2));
  });

  it('sans image en tête de contenu : utilise coverImage/title fournis en repli', () => {
    const blocks: Block[] = [paragraph('texte simple')];
    const { cover, bodyBlocks } = extractCover(blocks, 'fallback.webp', 'Titre de repli');
    expect(cover.image?.src).toBe('fallback.webp');
    expect(cover.title).toBe('Titre de repli');
    expect(bodyBlocks).toEqual(blocks);
  });

  it('un paragraphe trop long après le titre n’est jamais pris comme sous-titre (reste dans le corps)', () => {
    const longText = 'x'.repeat(200);
    const blocks: Block[] = [image('cover.webp'), heading('Titre', 1), paragraph(longText)];
    const { cover, bodyBlocks } = extractCover(blocks, undefined, undefined);
    expect(cover.subtitle).toBeNull();
    expect(bodyBlocks).toHaveLength(1);
    expect(bodyBlocks[0].type).toBe('paragraph');
  });
});
