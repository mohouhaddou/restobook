import { access, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { DirectoryManager } from "./DirectoryManager";
import { FileEventBus } from "./FileEvents";
import { PathResolver } from "./PathResolver";

/** Répertoires normalisés du workspace global. */
export const WORKSPACE_DIRECTORIES = [
  "incoming",
  "processing",
  "published",
  "failed",
  "archive",
  "temp",
  "logs",
] as const;

/** Gère le workspace racine et les espaces temporaires nommés. */
export class WorkspaceManager {
  private readonly resolver: PathResolver;

  public constructor(
    root: string,
    private readonly directories = new DirectoryManager(),
    private readonly events = new FileEventBus(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.resolver = new PathResolver(root);
  }

  /** Crée la structure globale ou un espace nommé dans `temp`. */
  public async createWorkspace(name?: string): Promise<string> {
    if (!name) {
      await Promise.all(
        WORKSPACE_DIRECTORIES.map((directory) =>
          this.directories.createDirectory(this.resolver.resolve(directory))),
      );
      this.emit("workspace:created", this.resolver.root);
      return this.resolver.root;
    }
    const workspace = this.resolver.resolve("temp", name);
    await this.directories.createDirectory(workspace);
    this.emit("workspace:created", workspace);
    return workspace;
  }

  /** Vide un espace sans supprimer son dossier. */
  public async clearWorkspace(name: string): Promise<void> {
    const workspace = this.resolver.resolve("temp", name);
    const entries = await readdir(workspace);
    await Promise.all(entries.map((entry) => rm(path.join(workspace, entry), {
      recursive: true,
      force: true,
    })));
    this.emit("workspace:cleared", workspace);
  }

  /** Déplace un espace temporaire vers les archives. */
  public async archiveWorkspace(name: string): Promise<string> {
    const source = this.resolver.resolve("temp", name);
    const destination = this.resolver.resolve("archive", name);
    await mkdir(path.dirname(destination), { recursive: true });
    await this.directories.moveDirectory(source, destination);
    this.emit("workspace:archived", destination);
    return destination;
  }

  /** Supprime un espace temporaire ou archivé. */
  public async deleteWorkspace(name: string): Promise<void> {
    const temporary = this.resolver.resolve("temp", name);
    const archived = this.resolver.resolve("archive", name);
    await Promise.all([
      this.directories.removeDirectory(temporary),
      this.directories.removeDirectory(archived),
    ]);
    this.emit("workspace:deleted", temporary);
  }

  /** Vérifie l'existence d'un espace temporaire ou archivé. */
  public async workspaceExists(name: string, archived = false): Promise<boolean> {
    try {
      await access(this.resolver.resolve(archived ? "archive" : "temp", name));
      return true;
    } catch {
      return false;
    }
  }

  private emit(type: Parameters<FileEventBus["emit"]>[0]["type"], target: string): void {
    this.events.emit({ type, path: target, timestamp: this.now().toISOString() });
  }
}
