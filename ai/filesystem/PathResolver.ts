import path from "node:path";
import { UnsafePathError } from "./FileErrors";

export type PathPlatform = "native" | "windows" | "posix";

/** Résout des chemins portables tout en confinant les accès dans une racine. */
export class PathResolver {
  public readonly root: string;

  public constructor(root: string) {
    this.root = path.resolve(root);
  }

  /** Résout un chemin relatif sous la racine configurée. */
  public resolve(...segments: readonly string[]): string {
    const resolved = path.resolve(this.root, ...segments);
    const relative = path.relative(this.root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new UnsafePathError(resolved);
    }
    return resolved;
  }

  /** Retourne un chemin relatif portable depuis la racine. */
  public relative(absolutePath: string): string {
    const resolved = path.resolve(absolutePath);
    this.resolve(path.relative(this.root, resolved));
    return path.relative(this.root, resolved);
  }

  /** Indique si le chemin reçu est absolu pour la plateforme choisie. */
  public isAbsolute(value: string, platform: PathPlatform = "native"): boolean {
    return this.pathApi(platform).isAbsolute(value);
  }

  /** Normalise les séparateurs et segments pour une plateforme donnée. */
  public normalize(value: string, platform: PathPlatform = "native"): string {
    return this.pathApi(platform).normalize(value);
  }

  private pathApi(platform: PathPlatform): typeof path {
    if (platform === "windows") return path.win32 as typeof path;
    if (platform === "posix") return path.posix as typeof path;
    return path;
  }
}
