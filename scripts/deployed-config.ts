import {
  deployedConfigEnv,
  deployedConfigFor,
} from "../common/src/deployed-config";
import { parseNodeEnv } from "../common/src/node-env";

const [arg, ...rest] = process.argv.slice(2);
const nodeEnv = parseNodeEnv(arg);
const config = nodeEnv.ok ? deployedConfigFor(nodeEnv.value) : undefined;
if (!config || rest.length) {
  console.error("usage: bun scripts/deployed-config.ts <staging|production>");
  process.exit(2);
}
for (const [key, value] of Object.entries(deployedConfigEnv(config))) {
  if (value !== undefined) console.log(`${key}=${value}`);
}
