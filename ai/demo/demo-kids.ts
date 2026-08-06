import contentJson from "../examples/publish-kids.json";
import type { ContentPackage } from "../types";
import { runDemo } from "./DemoRunner";

export function demoKids() {
  return runDemo(contentJson as ContentPackage);
}
