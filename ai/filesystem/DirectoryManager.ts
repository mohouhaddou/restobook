import { cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";

/** Opérations génériques et asynchrones sur les répertoires. */
export class DirectoryManager {
  public async createDirectory(directoryPath: string): Promise<void> {
    await mkdir(directoryPath, { recursive: true });
  }

  public async removeDirectory(directoryPath: string): Promise<void> {
    await rm(directoryPath, { recursive: true, force: true });
  }

  public async moveDirectory(source: string, destination: string): Promise<void> {
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(source, destination);
  }

  public async copyDirectory(source: string, destination: string): Promise<void> {
    await cp(source, destination, { recursive: true, force: false });
  }

  public async listDirectories(directoryPath: string): Promise<readonly string[]> {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }
}
