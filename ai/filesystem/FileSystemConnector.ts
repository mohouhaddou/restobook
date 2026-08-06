import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ContentPackage } from "../types";
import { InvalidFilePackageError } from "./FileErrors";
import { FileEventBus } from "./FileEvents";
import { FileLogger } from "./FileLogger";
import { FileValidator } from "./FileValidator";
import { PackageLocator, type ScannablePackageState } from "./PackageLocator";
import { PackageScanner, type ScannedContentPackage } from "./PackageScanner";
import { WorkspaceManager } from "./WorkspaceManager";

/** Fichiers binaires associés à un package, indexés par nom relatif sous `images/`. */
export type PackageImageFiles = Readonly<Record<string, Uint8Array>>;

/** Façade uniforme de dépôt, lecture et scan des ContentPackages. */
export class FileSystemConnector {
  public readonly workspaces: WorkspaceManager;
  public readonly scanner: PackageScanner;
  public readonly events: FileEventBus;
  public readonly logger: FileLogger;

  private readonly locator: PackageLocator;
  private readonly validator: FileValidator;

  public constructor(
    public readonly workspaceRoot: string,
    options: {
      readonly events?: FileEventBus;
      readonly logger?: FileLogger;
      readonly validator?: FileValidator;
      readonly now?: () => Date;
    } = {},
  ) {
    const now = options.now ?? (() => new Date());
    this.events = options.events ?? new FileEventBus();
    this.logger = options.logger ?? new FileLogger(now);
    this.validator = options.validator ?? new FileValidator();
    this.locator = new PackageLocator(workspaceRoot);
    this.workspaces = new WorkspaceManager(
      workspaceRoot,
      undefined,
      this.events,
      now,
    );
    this.scanner = new PackageScanner(workspaceRoot, this.validator, this.logger);
  }

  /** Dépose un package suivant la convention de fichiers commune. */
  public async writePackage(
    state: ScannablePackageState,
    content: ContentPackage,
    images: PackageImageFiles,
  ): Promise<string> {
    const directory = this.locator.packageDirectory(state, content.id);
    const imagesDirectory = path.join(directory, "images");
    await mkdir(imagesDirectory, { recursive: true });
    const { articleMarkdown, ...metadata } = content;
    await Promise.all([
      writeFile(path.join(directory, "article.md"), articleMarkdown, "utf8"),
      writeFile(
        path.join(directory, "metadata.json"),
        `${JSON.stringify(metadata, null, 2)}\n`,
        "utf8",
      ),
      ...Object.entries(images).map(async ([filename, bytes]) => {
        if (path.basename(filename) !== filename) {
          throw new InvalidFilePackageError([`Nom d'image non sûr : ${filename}.`]);
        }
        await writeFile(path.join(imagesDirectory, filename), bytes);
      }),
    ]);
    const validation = await this.validator.validate(directory);
    if (!validation.valid) throw new InvalidFilePackageError(validation.errors);
    this.emit("package:written", directory);
    return directory;
  }

  /** Lit un package précis depuis une file. */
  public async readPackage(
    state: ScannablePackageState,
    packageId: string,
  ): Promise<ContentPackage> {
    const directory = this.locator.packageDirectory(state, packageId);
    const validation = await this.validator.validate(directory);
    if (!validation.valid) throw new InvalidFilePackageError(validation.errors);
    const [articleMarkdown, metadataText] = await Promise.all([
      readFile(path.join(directory, "article.md"), "utf8"),
      readFile(path.join(directory, "metadata.json"), "utf8"),
    ]);
    this.emit("package:read", directory);
    return {
      ...(JSON.parse(metadataText) as Omit<ContentPackage, "articleMarkdown">),
      articleMarkdown,
    };
  }

  public scanPackages(): Promise<readonly ContentPackage[]> {
    return this.scanner.scan();
  }

  /** Variante technique conservant état et chemin de chaque package. */
  public scanPackageEntries(): Promise<readonly ScannedContentPackage[]> {
    return this.scanner.scanWithLocations();
  }

  private emit(type: "package:written" | "package:read", target: string): void {
    const timestamp = new Date().toISOString();
    this.events.emit({ type, path: target, timestamp });
    this.logger.log({ level: "info", operation: type, path: target, message: type });
  }
}
