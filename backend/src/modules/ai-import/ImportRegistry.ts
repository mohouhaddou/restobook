import type { ContentPackage, EditorId } from "../../../../ai/types";
import type { AIImportPackage } from "./AIImportTypes";
import { AIImportValidationError } from "./AIImportErrors";
import { resolveModule, type ModuleId } from "../ai-publisher/ModuleRegistry";

export interface ContentImporterContext {
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly publisher: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly articleMarkdown: string;
  readonly workspace: string;
  readonly files: readonly string[];
}

export interface ContentModuleImporter {
  readonly module: ModuleId;
  validate(context: ContentImporterContext): string[];
  importMetadata(context: ContentImporterContext): ContentPackage["metadata"];
  importMarkdown(context: ContentImporterContext): string;
  importImages(context: ContentImporterContext): ContentPackage["images"];
  importSocial(context: ContentImporterContext): Readonly<Record<string, string>>;
  importAssets(context: ContentImporterContext): readonly string[];
  publish(context: ContentImporterContext): ContentPackage;
}

const slugify = (value: string) => value.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export class GenericContentImporter implements ContentModuleImporter {
  public constructor(public readonly module: ModuleId) {}

  public validate(context: ContentImporterContext): string[] {
    const errors: string[] = [];
    if (typeof context.metadata.title !== "string" || !context.metadata.title.trim()) errors.push("metadata.json : title est obligatoire.");
    if (!context.articleMarkdown.trim()) errors.push("article.md est vide.");
    return errors;
  }

  public importMetadata(context: ContentImporterContext): ContentPackage["metadata"] {
    const metadata = context.metadata;
    const title = String(metadata.title ?? context.manifest.title ?? "Contenu importé");
    const slug = String(metadata.slug ?? slugify(title));
    const language = String(metadata.language ?? "fr") as "fr" | "ar" | "en";
    return {
      title, slug, excerpt: String(metadata.excerpt ?? title), description: String(metadata.description ?? title),
      keywords: Array.isArray(metadata.keywords) ? metadata.keywords.map(String) : [],
      tags: Array.isArray(metadata.tags) ? metadata.tags.map(String) : [],
      author: { name: String(metadata.author ?? "iFilino AI Import"), type: "ai-editor" },
      category: String(metadata.category ?? this.module), language,
      readingTime: Number(metadata.readingTime ?? 2), difficulty: "beginner",
      sources: [], license: { name: "iFilino editorial" },
    };
  }

  public importMarkdown(context: ContentImporterContext): string { return context.articleMarkdown; }

  public importImages(context: ContentImporterContext): ContentPackage["images"] {
    return context.files.filter(file => file.toLowerCase().endsWith(".webp")).map((file, index) => ({
      id: `image-${index}`, filename: file, alt: String(context.metadata.title ?? file), caption: "",
      role: file === "cover.webp" || index === 0 ? "cover" as const : "illustration" as const,
      width: 1600, height: 900, format: "webp" as const, relativePath: file, generated: false,
    }));
  }

  public importSocial(context: ContentImporterContext): Readonly<Record<string, string>> {
    return Object.fromEntries(context.files.filter(file => /^(facebook|instagram|youtube|tiktok|linkedin|x|reel_script)\.md$/i.test(file)).map(file => [file.replace(/\.md$/i, ""), file]));
  }

  public importAssets(context: ContentImporterContext): readonly string[] {
    return context.files.filter(file => !["manifest.json", "publisher.json", "metadata.json", "article.md"].includes(file));
  }

  public publish(context: ContentImporterContext): ContentPackage {
    const metadata = this.importMetadata(context);
    const articleMarkdown = this.importMarkdown(context);
    const now = new Date().toISOString();
    return {
      id: String(context.manifest.id ?? `import-${Date.now()}`), editor: this.module as EditorId,
      category: metadata.category, language: metadata.language, createdAt: now, updatedAt: now,
      articleMarkdown, sections: [{ heading: metadata.title, level: 2, content: articleMarkdown }],
      metadata, images: this.importImages(context),
      seo: {
        title: String(context.metadata.seoTitle ?? metadata.title),
        description: String(context.metadata.seoDescription ?? metadata.description),
        canonical: String(context.metadata.canonical ?? `https://ifilino.com/${this.module}/${metadata.slug}`),
        robots: "index,follow",
        openGraph: { title: metadata.title, description: metadata.description, type: "article", image: "cover.webp", siteName: "iFilino" },
        twitter: { card: "summary_large_image", title: metadata.title, description: metadata.description, image: "cover.webp" },
      },
      workflow: { editor: this.module as EditorId, version: "1.0.0", steps: [{ id: "zip-import", name: "Content Import Center", order: 1, status: "completed", requiresHumanReview: false }] },
      version: "1.0.0", status: "approved",
    };
  }
}

export class StoryImporter extends GenericContentImporter { public constructor(){super("stories");} }
export class NatureImporter extends GenericContentImporter { public constructor(){super("nature");} }
export class AnimalsImporter extends GenericContentImporter { public constructor(){super("animals");} }
export class SpaceImporter extends GenericContentImporter { public constructor(){super("space");} }
export class ScienceImporter extends GenericContentImporter { public constructor(){super("science");} }
export class StudyImporter extends GenericContentImporter { public constructor(){super("study");} }

export class ImportRegistry {
  private readonly importers = new Map<ModuleId, ContentModuleImporter>();
  public register(importer: ContentModuleImporter): this { this.importers.set(importer.module, importer); return this; }
  public resolve(rawModule: string): ContentModuleImporter {
    let module: ModuleId;
    try { module = resolveModule(rawModule).id; } catch {
      throw new AIImportValidationError([`UNKNOWN_MODULE: le module "${rawModule || "(absent)"}" déclaré dans manifest.json est inconnu.`]);
    }
    const importer = this.importers.get(module);
    if (!importer) throw new AIImportValidationError([`IMPORTER_NOT_REGISTERED: aucun importer enregistré pour "${module}".`]);
    return importer;
  }
  public modules(): readonly ModuleId[] { return [...this.importers.keys()]; }
}

export function createDefaultImportRegistry(): ImportRegistry {
  const registry = new ImportRegistry();
  for (const module of ["discover", "kids", "sports", "gaming"] as const) registry.register(new GenericContentImporter(module));
  registry.register(new StoryImporter()).register(new NatureImporter()).register(new AnimalsImporter()).register(new SpaceImporter()).register(new ScienceImporter()).register(new StudyImporter());
  return registry;
}
