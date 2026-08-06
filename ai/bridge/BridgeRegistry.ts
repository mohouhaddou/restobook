export class BridgeRegistry<T> {
  private readonly entries = new Map<string, T>();
  public register(id: string, value: T): void { if (this.entries.has(id)) throw new Error(`Entrée dupliquée : ${id}`); this.entries.set(id, value); }
  public unregister(id: string): boolean { return this.entries.delete(id); }
  public get(id: string): T { const value = this.entries.get(id); if (!value) throw new Error(`Entrée absente : ${id}`); return value; }
  public has(id: string): boolean { return this.entries.has(id); }
  public list(): readonly T[] { return [...this.entries.values()]; }
}
