import { deployedConfigFor, domainMove } from "../common/src/deployed-config";
import { parseNodeEnv } from "../common/src/node-env";

const [arg, ...rest] = process.argv.slice(2);
const nodeEnv = parseNodeEnv(arg);
const config = nodeEnv.ok ? deployedConfigFor(nodeEnv.value) : undefined;
if (!config || rest.length) {
  console.error("usage: bun scripts/deployed-config.ts <staging|production>");
  process.exit(2);
}
const { move, legacyDomain, newDomain } = domainMove(config);
const lines = {
  DOMAIN_NAME: config.DOMAIN_NAME,
  ALT_DOMAIN_NAME: config.ALT_DOMAIN_NAME,
  LEGACY_DOMAIN_NAME: legacyDomain,
  NEW_DOMAIN_NAME: newDomain,
  DOMAIN_MOVE: move,
  POSTHOG_PROJECT_ID: config.POSTHOG_PROJECT_ID,
};
for (const [key, value] of Object.entries(lines)) {
  console.log(`${key}=${value}`);
}
