// Prints the version the bump workflow moves a bundled CLI to, or nothing when it stays.
// Usage, from agents/desktop: bun scripts/bump-cli.ts @anthropic-ai/claude-code|@openai/codex
import { R } from "../../../common/src/result";
import {
  bundledCli,
  fetchRegistryPackage,
  proposedVersion,
} from "../src/main/agent/cli-bump";
import { pinnedVersions } from "../src/main/agent/cli-versions";

const cli = bundledCli.safeParse(process.argv[2]);
if (!cli.success)
  throw new Error(
    `usage: bun scripts/bump-cli.ts ${bundledCli.options.join("|")}`,
  );
const version = R.unwrap(
  proposedVersion({
    cli: cli.data,
    pinned: pinnedVersions[cli.data],
    registry: R.unwrap(await fetchRegistryPackage(cli.data)),
    now: new Date(),
  }),
);
if (version) console.log(version);
