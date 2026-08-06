import { SystemShutdown, type ShutdownPort } from "../bootstrap";

/** Arrêt explicite des ports fournis ; aucun processus global n'est recherché. */
export async function stopAI(ports: readonly ShutdownPort[] = []) {
  const stopped = await new SystemShutdown(ports).shutdown();
  console.log(`iFilino AI arrêté. Modules: ${stopped.join(", ") || "aucun actif"}`);
  return stopped;
}
