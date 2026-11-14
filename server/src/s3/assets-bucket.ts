import { ServiceUnavailableException } from "@nestjs/common";
import { env, requireEnv, withoutTeamSecrets } from "../config/env";

// Without the team's AWS access, S3 fails as a 500, or through pipeS3Object
// as a 404 that looks like a missing file.
export function assetsBucket(): string {
  if (
    withoutTeamSecrets({
      NODE_ENV: env("NODE_ENV"),
      ALLIANCE_WITHOUT_TEAM_SECRETS: env("ALLIANCE_WITHOUT_TEAM_SECRETS"),
    })
  ) {
    throw new ServiceUnavailableException(
      "Stored files need the team's AWS access, so they are off when running without the team's secrets",
    );
  }
  return requireEnv("ASSETS_BUCKET");
}
