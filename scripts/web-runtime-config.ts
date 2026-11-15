import { isDeployed, parseNodeEnv } from "../common/src/node-env";
import { webRuntimeConfigFor } from "../common/src/web-runtime-config";

const [arg, ...rest] = process.argv.slice(2);
const nodeEnv = parseNodeEnv(arg);
if (!nodeEnv.ok || !isDeployed(nodeEnv.value) || rest.length) {
  console.error(
    "usage: bun scripts/web-runtime-config.ts <staging|production>",
  );
  process.exit(2);
}
const config = webRuntimeConfigFor(nodeEnv.value);
if (!config.ok) {
  console.error(config.error.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify(config.value));
