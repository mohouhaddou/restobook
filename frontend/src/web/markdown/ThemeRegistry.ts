import type { MarkdownTheme } from './MarkdownTheme';

/**
 * Registre central des thèmes Markdown. Unique responsabilité : associer un
 * identifiant de module à un thème. Ajouter un futur module (Education, Santé,
 * Voyage...) = un `register(id, theme)` ici, jamais une modification du
 * MarkdownRenderer ou du Parser.
 */
class ThemeRegistryImpl {
  private readonly themes = new Map<string, MarkdownTheme>();

  register(id: string, theme: MarkdownTheme): void {
    this.themes.set(id, theme);
  }

  get(id: string): MarkdownTheme | undefined {
    return this.themes.get(id);
  }

  has(id: string): boolean {
    return this.themes.has(id);
  }

  list(): readonly MarkdownTheme[] {
    return [...this.themes.values()];
  }
}

export const ThemeRegistry = new ThemeRegistryImpl();
