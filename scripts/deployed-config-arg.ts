import { basename } from "node:path";
import {
  type DeployedConfig,
  deployedConfigFor,
} from "../common/src/deployed-config";
import { parseNodeEnv } from "../common/src/node-env";

export function deployedConfigFromArgv(): DeployedConfig {
  const [arg, ...rest] = process.argv.slice(2);
  const nodeEnv = parseNodeEnv(arg);
  const config = nodeEnv.ok ? deployedConfigFor(nodeEnv.value) : undefined;
  if (!config || rest.length) {
    console.error(
      `usage: bun scripts/${basename(process.argv[1])} <staging|production>`,
    );
    process.exit(2);
  }
  return config;
}
