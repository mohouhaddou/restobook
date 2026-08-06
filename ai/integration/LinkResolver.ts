/** Résultat d'analyse d'un lien Markdown ou HTML. */
export interface ResolvedLink {
  readonly original: string;
  readonly normalized: string;
  readonly external: boolean;
  readonly valid: boolean;
}

/** Valide les liens HTTP(S), ancres et chemins relatifs sans effectuer de requête. */
export class LinkResolver {
  public resolve(value: string): ResolvedLink {
    const original = value.trim();
    const external = /^https?:\/\//i.test(original);
    let valid = false;
    if (external) {
      try {
        const parsed = new URL(original);
        valid = parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        valid = false;
      }
    } else {
      valid = /^(?:\/(?!\/)|\.{0,2}\/|#)[^\s]*$/.test(original);
    }
    return { original, normalized: original, external, valid };
  }
}
