import { formatEnvProblems } from "@alliance/common/env";
import {
  unsetTeamOnlyKeys,
  validateServerEnv,
  withoutTeamSecrets,
} from "./env";

const result = validateServerEnv();
if (!result.ok) {
  console.error(
    formatEnvProblems({
      heading: "ERR: Invalid environment",
      problems: result.error,
    }),
  );
  process.exit(1);
}
if (withoutTeamSecrets(result.value)) {
  const unset = unsetTeamOnlyKeys(result.value);
  console.warn(
    `Running without the team's secrets (ALLIANCE_WITHOUT_TEAM_SECRETS): stored files are off${unset.length ? `; unset: ${unset.join(", ")}` : ""}`,
  );
}
