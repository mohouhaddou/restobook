import contentJson from "../examples/publish-stories.json";
import type { ContentPackage } from "../types";
import { runDemo } from "./DemoRunner";

export function demoStories() {
  return runDemo(contentJson as ContentPackage);
}
