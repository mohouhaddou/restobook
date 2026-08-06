import type { BaseModule } from "./BaseModule"; import { ModuleRegistry } from "./ModuleRegistry"; import { ModuleValidator } from "./ModuleValidator";
export class ModuleLoader {
  public constructor(private readonly registry: ModuleRegistry, private readonly validator = new ModuleValidator()) {}
  public load(module: BaseModule): void { const errors = this.validator.validate(module.manifest); if (errors.length) throw new Error(errors.join("; ")); for (const dep of module.manifest.dependencies) if (!this.registry.has(dep)) throw new Error(`Dépendance absente : ${dep}`); this.registry.register(module); }
}
