import contentJson from "../examples/publish-gaming.json";
import type { ContentPackage } from "../types";
import { runDemo } from "./DemoRunner";

export function demoGaming() {
  return runDemo(contentJson as ContentPackage);
}
