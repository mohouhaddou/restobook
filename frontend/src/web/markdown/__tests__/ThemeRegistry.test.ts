import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeRegistry } from '../ThemeRegistry';
import { ThemeResolver } from '../ThemeResolver';
import type { MarkdownTheme } from '../MarkdownTheme';

function makeTheme(id: string): MarkdownTheme {
  return {
    id,
    label: id,
    classes: {
      container: `${id}-container`, heading1: '', heading2: '', heading3: '',
      paragraph: '', image: '', table: '', tableWrapper: '', quote: '', callout: '', code: '', list: '', faq: '',
    },
  };
}

describe('ThemeRegistry', () => {
  it('enregistre et retrouve un thème par id', () => {
    const theme = makeTheme('test-module-a');
    ThemeRegistry.register('test-module-a', theme);
    expect(ThemeRegistry.get('test-module-a')).toBe(theme);
    expect(ThemeRegistry.has('test-module-a')).toBe(true);
  });

  it('retourne undefined pour un module jamais enregistré', () => {
    expect(ThemeRegistry.get('module-totalement-inconnu')).toBeUndefined();
  });
});

describe('ThemeResolver', () => {
  beforeEach(() => {
    ThemeRegistry.register('discover', makeTheme('discover'));
    ThemeRegistry.register('kids', makeTheme('kids'));
  });

  it("résout le thème du module demandé", () => {
    expect(ThemeResolver.resolve('kids').id).toBe('kids');
  });

  it('retombe sur le thème Discover si le module est inconnu (jamais un crash)', () => {
    expect(ThemeResolver.resolve('module-education-pas-encore-cree').id).toBe('discover');
  });

  it('retombe sur Discover si aucun module n\'est fourni', () => {
    expect(ThemeResolver.resolve(undefined).id).toBe('discover');
  });

  it('resolveFromPathname déduit le module depuis la route courante', () => {
    expect(ThemeResolver.resolveFromPathname('/kids/content/une-histoire').id).toBe('kids');
  });
});
