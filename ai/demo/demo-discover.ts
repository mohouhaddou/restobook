import contentJson from "../examples/publish-discover.json";
import type { ContentPackage } from "../types";
import { runDemo } from "./DemoRunner";

export function demoDiscover() {
  return runDemo(contentJson as ContentPackage);
}
