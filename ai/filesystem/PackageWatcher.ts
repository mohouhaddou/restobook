import type { ScannablePackageState } from "./PackageLocator";

/** Notification prévue pour une future implémentation de surveillance. */
export interface PackageWatchEvent {
  readonly state: ScannablePackageState;
  readonly packageDirectory: string;
  readonly detectedAt: string;
}

export type PackageWatchListener = (event: PackageWatchEvent) => void;

/**
 * Contrat indépendant d'un watcher.
 * Aucune implémentation ni surveillance automatique n'est démarrée dans cette phase.
 */
export interface PackageWatcher {
  readonly isRunning: boolean;
  start(listener: PackageWatchListener): Promise<void>;
  stop(): Promise<void>;
}
