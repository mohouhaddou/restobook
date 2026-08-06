import { PathResolver } from "./PathResolver";

/** États de files parcourus automatiquement par le scanner. */
export type ScannablePackageState =
  | "incoming"
  | "processing"
  | "published"
  | "failed";

export const SCANNABLE_PACKAGE_STATES: readonly ScannablePackageState[] = [
  "incoming",
  "processing",
  "published",
  "failed",
];

/** Construit les emplacements canoniques des packages. */
export class PackageLocator {
  private readonly resolver: PathResolver;

  public constructor(workspaceRoot: string) {
    this.resolver = new PathResolver(workspaceRoot);
  }

  public stateDirectory(state: ScannablePackageState): string {
    return this.resolver.resolve(state);
  }

  public packageDirectory(state: ScannablePackageState, packageId: string): string {
    return this.resolver.resolve(state, packageId);
  }
}
