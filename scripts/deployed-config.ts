import { domainMove } from "../common/src/deployed-config";
import { deployedConfigFromArgv } from "./deployed-config-arg";

const config = deployedConfigFromArgv();
const { legacyDomain, newDomain } = domainMove(config);
const lines = {
  DOMAIN_NAME: config.DOMAIN_NAME,
  ALT_DOMAIN_NAME: config.ALT_DOMAIN_NAME,
  LEGACY_DOMAIN_NAME: legacyDomain,
  NEW_DOMAIN_NAME: newDomain,
  POSTHOG_PROJECT_ID: config.POSTHOG_PROJECT_ID,
};
for (const [key, value] of Object.entries(lines)) {
  console.log(`${key}=${value}`);
}
