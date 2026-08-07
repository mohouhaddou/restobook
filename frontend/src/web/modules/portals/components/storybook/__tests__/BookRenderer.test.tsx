import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { BookRenderer } from '../BookRenderer';
import { DiscoverTheme } from '../../../../../markdown/themes/DiscoverTheme';
import type { PaginatedPage } from '../StoryPaginator';
import type { StoryLayoutBox } from '../StoryLayoutEngine';

afterEach(cleanup);

function scenePage(text: string): PaginatedPage {
  return {
    blocks: [{ type: 'paragraph', html: `<p>${text}</p>` }],
    image: { type: 'image', src: 'scene.webp', alt: '', title: null },
    kind: 'scene',
    isChapterStart: false,
  };
}

function coverPage(): PaginatedPage {
  return {
    blocks: [],
    image: { type: 'image', src: 'cover.webp', alt: '', title: null },
    kind: 'cover',
    isChapterStart: false,
    title: 'Le titre du livre',
    subtitle: null,
  };
}

function layoutFor(mode: 'single' | 'spread', direction: 'ltr' | 'rtl' = 'ltr'): StoryLayoutBox {
  const width = mode === 'spread' ? 1200 : 400;
  const columns = mode === 'spread' ? 2 : 1;
  return { mode, columns, width, height: 800, pageWidth: width / columns, pageHeight: 800, direction };
}

const PAGES: PaginatedPage[] = [coverPage(), scenePage('Scène 1'), scenePage('Scène 2'), scenePage('Scène 3')];

describe('BookRenderer', () => {
  it('un seul écran affiché à la fois — jamais deux pages côte à côte, paysage ou portrait', () => {
    const { container } = render(<BookRenderer pages={PAGES} layout={layoutFor('spread')} currentIndex={1} onNavigate={() => {}} theme={DiscoverTheme} />);
    expect(container.textContent).toContain('Scène 1');
    expect(container.textContent).not.toContain('Scène 2');
    expect(container.querySelectorAll('.story-page')).toHaveLength(1);
  });

  it('avance d’un seul écran à la fois au clic (jamais par 2, même en paysage)', () => {
    const onNavigate = vi.fn();
    const { getByLabelText } = render(<BookRenderer pages={PAGES} layout={layoutFor('spread')} currentIndex={1} onNavigate={onNavigate} theme={DiscoverTheme} />);
    fireEvent.click(getByLabelText('Page suivante'));
    expect(onNavigate).toHaveBeenCalledWith(2);
  });

  it('navigue au clavier (flèches gauche/droite)', () => {
    const onNavigate = vi.fn();
    render(<BookRenderer pages={PAGES} layout={layoutFor('single')} currentIndex={1} onNavigate={onNavigate} theme={DiscoverTheme} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith(2);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it('désactive précédent sur le premier écran et suivant sur le dernier', () => {
    const { getByLabelText, rerender } = render(<BookRenderer pages={PAGES} layout={layoutFor('single')} currentIndex={1} onNavigate={() => {}} theme={DiscoverTheme} />);
    expect(getByLabelText('Page précédente')).not.toBeDisabled();
    rerender(<BookRenderer pages={PAGES} layout={layoutFor('single')} currentIndex={3} onNavigate={() => {}} theme={DiscoverTheme} />);
    expect(getByLabelText('Page suivante')).toBeDisabled();
  });

  it('la couverture n’affiche aucune flèche de navigation — seul son bouton "Commencer" fait avancer', () => {
    const onNavigate = vi.fn();
    const { container, queryByLabelText, getByText } = render(
      <BookRenderer pages={PAGES} layout={layoutFor('single')} currentIndex={0} onNavigate={onNavigate} theme={DiscoverTheme} startLabel="Commencer" />,
    );
    expect(queryByLabelText('Page suivante')).toBeNull();
    expect(queryByLabelText('Page précédente')).toBeNull();
    expect(container.querySelector('.cover-page-title')?.textContent).toBe('Le titre du livre');
    fireEvent.click(getByText('Commencer'));
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("ne partage jamais sa largeur/hauteur mesurée avec un autre élément (pas de frère dans .storybook-frame)", () => {
    const { container } = render(<BookRenderer pages={PAGES} layout={layoutFor('single')} currentIndex={1} onNavigate={() => {}} theme={DiscoverTheme} />);
    const frame = container.querySelector('.storybook-frame');
    expect([...frame!.children].map(c => c.className)).not.toContain(expect.stringContaining('storybook-progress'));
  });

  // Le swipe tactile (framer-motion drag="x") est vérifié visuellement en conditions réelles
  // (Playwright, cf. rapport final) — la gestuelle pointer bas niveau de framer-motion n'est pas
  // fidèlement simulable via jsdom/fireEvent.
});

describe('BookRenderer — RTL (arabe)', () => {
  it('en RTL, le bouton physique de GAUCHE avance dans l’histoire (logique de lecture inversée)', () => {
    const onNavigate = vi.fn();
    const { getByLabelText } = render(<BookRenderer pages={PAGES} layout={layoutFor('single', 'rtl')} currentIndex={1} onNavigate={onNavigate} theme={DiscoverTheme} />);
    fireEvent.click(getByLabelText('Page suivante'));
    expect(onNavigate).toHaveBeenCalledWith(2);
  });

  it('flèches clavier inversées en RTL : ArrowLeft avance, ArrowRight recule', () => {
    const onNavigate = vi.fn();
    render(<BookRenderer pages={PAGES} layout={layoutFor('single', 'rtl')} currentIndex={1} onNavigate={onNavigate} theme={DiscoverTheme} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onNavigate).toHaveBeenCalledWith(2);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it('chaque écran porte dir="rtl" pour l’alignement du texte', () => {
    const { container } = render(<BookRenderer pages={PAGES} layout={layoutFor('single', 'rtl')} currentIndex={1} onNavigate={() => {}} theme={DiscoverTheme} />);
    expect(container.querySelector('.story-page')?.getAttribute('dir')).toBe('rtl');
  });
});
