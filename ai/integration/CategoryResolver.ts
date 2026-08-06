import type { EditorId } from "../types";

/** Cible canonique et préfixe d'assets associés à une rédaction. */
export interface ResolvedCategory {
  readonly editor: EditorId;
  readonly product: "Discover" | "Sports" | "Kids" | "Stories" | "GamingHub";
  readonly category: string;
}

const PRODUCTS: Readonly<Record<EditorId, ResolvedCategory["product"]>> = {
  discover: "Discover",
  sports: "Sports",
  kids: "Kids",
  stories: "Stories",
  gaming: "GamingHub",
  nature: "Kids",
  animals: "Kids",
  space: "Kids",
  science: "Kids",
  study: "Kids",
};

/** Résout une catégorie générique pour chacun des cinq produits. */
export class CategoryResolver {
  public resolve(editor: EditorId, category: string): ResolvedCategory {
    return {
      editor,
      product: PRODUCTS[editor],
      category: category.trim().toLowerCase().replace(/\s+/g, "-"),
    };
  }
}
