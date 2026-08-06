import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Job } from "./Job";

export interface JobPersistence {
  load(): Promise<readonly Job[]>;
  save(jobs: readonly Job[]): Promise<void>;
}

/** Persistence volatile utilisée par les tests et le mode Mock. */
export class MemoryJobPersistence implements JobPersistence {
  private jobs: Job[] = [];
  public async load(): Promise<readonly Job[]> { return structuredClone(this.jobs); }
  public async save(jobs: readonly Job[]): Promise<void> { this.jobs = structuredClone([...jobs]); }
}

/** Snapshot JSON atomique permettant la restauration après redémarrage. */
export class JsonJobPersistence implements JobPersistence {
  public constructor(private readonly path: string) {}
  public async load(): Promise<readonly Job[]> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as Job[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  public async save(jobs: readonly Job[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, JSON.stringify(jobs, null, 2), "utf8");
    await rename(temporary, this.path);
  }
}
