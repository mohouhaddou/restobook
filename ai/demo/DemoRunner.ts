import type { ContentPackage } from "../types";
import { ContentValidator } from "../content-manager";

export interface DemoStep {
  readonly name: "ContentPackage" | "Validation" | "Workflow" | "Publisher" | "Integration" | "Backend" | "Résultat";
  readonly status: "SUCCESS";
}

export interface DemoReport {
  readonly editor: ContentPackage["editor"];
  readonly packageId: string;
  readonly simulated: true;
  readonly status: "SUCCESS";
  readonly steps: readonly DemoStep[];
}

/** Démonstration déterministe sans accès réseau, base ou publication. */
export async function runDemo(content: ContentPackage): Promise<DemoReport> {
  const validation = new ContentValidator().validate(content);
  if (!validation.valid) {
    throw new Error(`Démonstration invalide : `);
  }
  const names: readonly DemoStep["name"][] = [
    "ContentPackage",
    "Validation",
    "Workflow",
    "Publisher",
    "Integration",
    "Backend",
    "Résultat",
  ];
  return {
    editor: content.editor,
    packageId: content.id,
    simulated: true,
    status: "SUCCESS",
    steps: names.map((name) => ({ name, status: "SUCCESS" })),
  };
}
