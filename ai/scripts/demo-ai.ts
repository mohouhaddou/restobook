import { demoAll } from "../demo";

export async function demoAI() {
  const report = await demoAll();
  console.log(JSON.stringify(report, null, 2));
  return report;
}
