/**
 * Source unique de vérité pour les modules éditoriaux iFilino (Discover, Stories, Kids,
 * Sports, Gaming, ...). Toute résolution de module (service, repository, catégories,
 * dossier uploads, URLs) doit passer par ce registre plutôt que par un switch dispersé
 * dans le code du Publisher.
 *
 * Ajouter un nouveau module = ajouter une entrée ici. Aucune autre modification du
 * Publisher ne doit être nécessaire.
 */

export type ModuleId = "discover" | "stories" | "kids" | "sports" | "gaming" | "nature" | "animals" | "space" | "science" | "study";

export type ModelKind = "article" | "portal" | "gaming" | "study";

export interface ModuleDefinition {
  /** Identifiant canonique, utilisé dans les routes, URLs et le dossier uploads. */
  readonly id: ModuleId;
  /** Nom lisible pour les messages d'erreur et logs. */
  readonly label: string;
  /** Anciens noms/alias acceptés dans manifest.json (ex. "gaminghub" -> "gaming"). */
  readonly aliases: readonly string[];
  /** Famille de modèle Sequelize ciblée par le repository de publication. */
  readonly modelKind: ModelKind;
  /**
   * Pour modelKind="portal" : valeur réelle de la colonne PortalContent.portal
   * (ENUM('sports','kids')). Plusieurs modules logiques peuvent partager le même
   * portail physique (ex. Stories publie dans le portail Kids).
   */
  readonly portalName?: "sports" | "kids";
  /** Catégories éditoriales valides ; absent = pas de restriction de catégorie. */
  readonly categories?: readonly string[];
  /** Catégorie appliquée quand la catégorie fournie est absente ou invalide. */
  readonly defaultCategory: string;
  /**
   * Si défini, la catégorie (ou content_type) est toujours forcée à cette valeur,
   * quelle que soit celle fournie par le paquet (ex. Stories est toujours filé sous
   * content_type="stories" dans le portail Kids).
   */
  readonly fixedCategory?: string;
}

export const MODULE_REGISTRY: Readonly<Record<ModuleId, ModuleDefinition>> = {
  discover: {
    id: "discover",
    label: "Discover",
    aliases: [],
    modelKind: "article",
    categories: [
      "guide", "recette", "promotion", "conseil", "actualite",
      "nouveau_commerce", "nouveau_produit", "vie_locale", "portrait",
    ],
    defaultCategory: "actualite",
  },
  stories: {
    id: "stories",
    label: "Stories",
    aliases: ["story", "ifilino-story-publication", "ifilino-stories-publication"],
    modelKind: "portal",
    portalName: "kids",
    defaultCategory: "stories",
    fixedCategory: "stories",
  },
  kids: {
    id: "kids",
    label: "Kids",
    aliases: [],
    modelKind: "portal",
    portalName: "kids",
    defaultCategory: "article",
  },
  sports: {
    id: "sports",
    label: "Sports",
    aliases: [],
    modelKind: "portal",
    portalName: "sports",
    defaultCategory: "article",
  },
  gaming: {
    id: "gaming",
    label: "Gaming",
    aliases: ["gaminghub"],
    modelKind: "gaming",
    categories: ["actualite", "guide", "astuce", "test", "classement", "comparatif", "top", "collection"],
    defaultCategory: "actualite",
  },
  nature: { id: "nature", label: "Nature", aliases: ["ifilino-nature-publication"], modelKind: "portal", portalName: "kids", defaultCategory: "nature", fixedCategory: "nature" },
  animals: { id: "animals", label: "Animals", aliases: ["animal", "ifilino-animals-publication"], modelKind: "portal", portalName: "kids", defaultCategory: "animals", fixedCategory: "animals" },
  space: { id: "space", label: "Space", aliases: ["ifilino-space-publication"], modelKind: "portal", portalName: "kids", defaultCategory: "space", fixedCategory: "space" },
  science: { id: "science", label: "Science", aliases: ["ifilino-science-publication"], modelKind: "portal", portalName: "kids", defaultCategory: "science", fixedCategory: "science" },
  study: { id: "study", label: "Study", aliases: ["lesson", "lessons", "studies", "ifilino-study-publication"], modelKind: "study", defaultCategory: "lesson", fixedCategory: "lesson" },
};

export const MODULE_IDS = Object.keys(MODULE_REGISTRY) as readonly ModuleId[];

export class UnknownModuleError extends Error {
  public readonly code = "UNKNOWN_MODULE" as const;
  public constructor(public readonly value: string) {
    super(
      `UNKNOWN_MODULE: le module "${value}" est inconnu. Modules disponibles : ${MODULE_IDS.join(", ")}.`,
    );
    this.name = "UnknownModuleError";
  }
}

/** Normalise une valeur brute (casse, espaces, alias) vers un identifiant candidat. */
function normalizeId(raw: string): string {
  const value = raw.trim().toLowerCase();
  for (const definition of Object.values(MODULE_REGISTRY)) {
    if (definition.id === value || definition.aliases.includes(value)) return definition.id;
  }
  return value;
}

export function isKnownModule(raw: string): raw is ModuleId {
  return normalizeId(raw) in MODULE_REGISTRY;
}

/** Résout un module à partir d'une valeur brute ; lève UnknownModuleError sinon. */
export function resolveModule(raw: string): ModuleDefinition {
  const id = normalizeId(raw);
  const definition = (MODULE_REGISTRY as Record<string, ModuleDefinition>)[id];
  if (!definition) throw new UnknownModuleError(raw);
  return definition;
}

/** Normalise une catégorie brute selon les règles du module résolu. */
export function normalizeCategory(moduleId: ModuleId, rawCategory: string | undefined): string {
  const definition = MODULE_REGISTRY[moduleId];
  if (definition.fixedCategory) return definition.fixedCategory;
  const value = (rawCategory ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!value) return definition.defaultCategory;
  if (definition.categories && !definition.categories.includes(value)) return definition.defaultCategory;
  return value;
}
