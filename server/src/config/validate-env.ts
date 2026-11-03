import { formatEnvProblems } from "@alliance/common/env";
import { validateServerEnv } from "./env";

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
