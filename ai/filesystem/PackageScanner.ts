import { readFile, readdir } from "node:fs/promises";
import type { ContentPackage } from "../types";
import { InvalidFilePackageError } from "./FileErrors";
import { FileLogger } from "./FileLogger";
import { FileValidator } from "./FileValidator";
import {
  PackageLocator,
  SCANNABLE_PACKAGE_STATES,
  type ScannablePackageState,
} from "./PackageLocator";

/** Package chargé avec son emplacement d'origine. */
export interface ScannedContentPackage {
  readonly state: ScannablePackageState;
  readonly directory: string;
  readonly package: ContentPackage;
}

/** Parcourt les quatre files de travail et reconstruit les ContentPackages. */
export class PackageScanner {
  private readonly locator: PackageLocator;

  public constructor(
    workspaceRoot: string,
    private readonly validator = new FileValidator(),
    private readonly logger = new FileLogger(),
  ) {
    this.locator = new PackageLocator(workspaceRoot);
  }

  /** Retourne directement la liste des ContentPackages valides. */
  public async scan(): Promise<readonly ContentPackage[]> {
    return (await this.scanWithLocations()).map((entry) => entry.package);
  }

  /** Retourne les packages avec leur état et emplacement pour les outils techniques. */
  public async scanWithLocations(): Promise<readonly ScannedContentPackage[]> {
    const results: ScannedContentPackage[] = [];
    for (const state of SCANNABLE_PACKAGE_STATES) {
      let entries;
      try {
        entries = await readdir(this.locator.stateDirectory(state), { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
        const directory = this.locator.packageDirectory(state, entry.name);
        const validation = await this.validator.validate(directory);
        if (!validation.valid) throw new InvalidFilePackageError(validation.errors);
        const [articleMarkdown, metadataText] = await Promise.all([
          readFile(`${directory}/article.md`, "utf8"),
          readFile(`${directory}/metadata.json`, "utf8"),
        ]);
        const metadata = JSON.parse(metadataText) as Omit<ContentPackage, "articleMarkdown">;
        results.push({
          state,
          directory,
          package: { ...metadata, articleMarkdown },
        });
      }
    }
    this.logger.log({
      level: "info",
      operation: "scan",
      path: "workspace",
      message: `${results.length} package(s) détecté(s).`,
    });
    return results.sort((left, right) => left.package.id.localeCompare(right.package.id));
  }
}
