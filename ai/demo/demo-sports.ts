import contentJson from "../examples/publish-sports.json";
import type { ContentPackage } from "../types";
import { runDemo } from "./DemoRunner";

export function demoSports() {
  return runDemo(contentJson as ContentPackage);
}
