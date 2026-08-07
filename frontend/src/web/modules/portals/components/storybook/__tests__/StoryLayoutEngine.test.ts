import { describe, it, expect } from 'vitest';
import { resolveStoryLayout } from '../StoryLayoutEngine';

describe('resolveStoryLayout', () => {
  it('Desktop (1440×900) → livre ouvert à deux pages', () => {
    const box = resolveStoryLayout(1440, 900);
    expect(box.mode).toBe('spread');
    expect(box.columns).toBe(2);
    expect(box.pageWidth).toBe(1440 / 2); // pas de reliure/goutière : écran divisé en deux, à parts égales
  });

  it('Grand écran (1920×1080) → livre ouvert à deux pages', () => {
    expect(resolveStoryLayout(1920, 1080).mode).toBe('spread');
  });

  it('Petit écran (320×568) → page unique', () => {
    const box = resolveStoryLayout(320, 568);
    expect(box.mode).toBe('single');
    expect(box.columns).toBe(1);
    expect(box.pageWidth).toBe(320);
  });

  it('Tablette PAYSAGE (1024×768) → livre ouvert à deux pages', () => {
    expect(resolveStoryLayout(1024, 768).mode).toBe('spread');
  });

  it('Tablette PORTRAIT (768×1024) → page unique (même largeur que la tablette paysage, mode différent)', () => {
    const box = resolveStoryLayout(768, 1024);
    expect(box.mode).toBe('single');
  });

  it('Mobile portrait (390×844) → page unique', () => {
    expect(resolveStoryLayout(390, 844).mode).toBe('single');
  });

  it('une largeur suffisante en portrait ne bascule jamais en spread (largeur ET paysage requis)', () => {
    expect(resolveStoryLayout(1200, 1800).mode).toBe('single');
  });

  it('conteneur non mesuré (0×0) → repli sûr sur single, jamais de division par zéro', () => {
    const box = resolveStoryLayout(0, 0);
    expect(box.mode).toBe('single');
    expect(box.pageWidth).toBe(0);
  });
});

describe('resolveStoryLayout — sens de lecture (direction)', () => {
  it('français/anglais (par défaut) → ltr', () => {
    expect(resolveStoryLayout(1440, 900).direction).toBe('ltr');
    expect(resolveStoryLayout(1440, 900, 'en').direction).toBe('ltr');
  });

  it('arabe → rtl, quel que soit le mode (desktop comme mobile)', () => {
    expect(resolveStoryLayout(1440, 900, 'ar').direction).toBe('rtl');
    expect(resolveStoryLayout(390, 844, 'ar').direction).toBe('rtl');
  });

  it('la direction ne change jamais le mode (single/spread) : ce sont deux décisions indépendantes', () => {
    const ltr = resolveStoryLayout(1440, 900, 'fr');
    const rtl = resolveStoryLayout(1440, 900, 'ar');
    expect(ltr.mode).toBe(rtl.mode);
    expect(ltr.pageWidth).toBe(rtl.pageWidth);
  });

  it('conteneur non mesuré (0×0) en arabe → repli sûr, direction rtl tout de même préservée', () => {
    expect(resolveStoryLayout(0, 0, 'ar').direction).toBe('rtl');
  });
});
