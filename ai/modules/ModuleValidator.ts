import type { ModuleManifest } from "./ModuleManifest";
export class ModuleValidator {
  public validate(manifest: ModuleManifest): readonly string[] {
    const errors: string[] = [];
    if (!manifest.id.trim()) errors.push("id requis");
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) errors.push("version invalide");
    if (!manifest.entryPoint.trim()) errors.push("entryPoint requis");
    if (manifest.dependencies.includes(manifest.id)) errors.push("auto-dépendance interdite");
    return errors;
  }
}
