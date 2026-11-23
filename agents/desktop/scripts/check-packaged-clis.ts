// electron-builder only warns when an extraResources source is missing, so a build without a CLI would otherwise succeed. The mode check keeps after-pack.mjs's fix in place.
import { statSync } from "node:fs";
import { R } from "../../../common/src/result";
import { findExecutable } from "../src/main/cli-executable";
import { AgentKind } from "../src/shared/agent-kind";
import { packagedApp } from "./packaged-app";

for (const agent of Object.values(AgentKind)) {
  const executable = R.unwrap(
    findExecutable({
      agent,
      env: {},
      packaged: true,
      root: packagedApp.resources,
      platform: process.platform,
      arch: packagedApp.arch,
    }),
  );
  if (statSync(executable).mode & 0o022)
    throw new Error(`${executable} is writable by other users.`);
}
