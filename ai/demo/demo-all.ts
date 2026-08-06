import { demoDiscover } from "./demo-discover";
import { demoGaming } from "./demo-gaming";
import { demoKids } from "./demo-kids";
import { demoSports } from "./demo-sports";
import { demoStories } from "./demo-stories";
import type { DemoReport } from "./DemoRunner";

export interface AllDemosReport {
  readonly status: "SUCCESS";
  readonly publications: 5;
  readonly reports: readonly DemoReport[];
}

/** Simule successivement les cinq rédactions et agrège le rapport final. */
export async function demoAll(): Promise<AllDemosReport> {
  const reports = await Promise.all([
    demoDiscover(),
    demoSports(),
    demoKids(),
    demoStories(),
    demoGaming(),
  ]);
  return { status: "SUCCESS", publications: 5, reports };
}
