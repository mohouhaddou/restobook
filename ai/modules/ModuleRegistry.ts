import type { BaseModule } from "./BaseModule";
export class ModuleRegistry {
  private readonly items = new Map<string, BaseModule>();
  public register(module: BaseModule): void { if (this.items.has(module.manifest.id)) throw new Error("Module dupliqué"); this.items.set(module.manifest.id, module); }
  public get(id: string): BaseModule { const item = this.items.get(id); if (!item) throw new Error(`Module absent : ${id}`); return item; }
  public list(): readonly BaseModule[] { return [...this.items.values()]; }
  public has(id: string): boolean { return this.items.has(id); }
  public unregister(id: string): boolean { return this.items.delete(id); }
}
