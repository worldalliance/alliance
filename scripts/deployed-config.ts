import { deployedConfigFor } from "../common/src/deployed-config";
import { parseNodeEnv } from "../common/src/node-env";

const [arg, ...rest] = process.argv.slice(2);
const nodeEnv = parseNodeEnv(arg);
const config = nodeEnv.ok ? deployedConfigFor(nodeEnv.value) : undefined;
if (!config || rest.length) {
  console.error("usage: bun scripts/deployed-config.ts <staging|production>");
  process.exit(2);
}
for (const key of [
  "DOMAIN_NAME",
  "ALT_DOMAIN_NAME",
  "POSTHOG_PROJECT_ID",
] as const) {
  console.log(`${key}=${config[key]}`);
}
