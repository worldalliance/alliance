import { execFileSync } from "node:child_process";

/** Takes group and other write permission off every packaged file, since Claude Code's npm package ships its binary writable by every user and extraResources keeps the mode, which would let any local user replace the claude another user's app runs. */
export default function afterPack(context) {
  execFileSync("chmod", ["-R", "go-w", context.appOutDir]);
}
