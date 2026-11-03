import { isDeployed, type NodeEnv } from "@alliance/common/node-env";

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function socketCorsOrigins({
  nodeEnv,
  appUrl,
  altAppUrl,
  adminUrl,
  altAdminUrl,
}: {
  nodeEnv: NodeEnv;
  appUrl: string | undefined;
  altAppUrl: string | undefined;
  adminUrl: string | undefined;
  altAdminUrl: string | undefined;
}): (string | RegExp)[] {
  const deployed = [appUrl, altAppUrl, adminUrl, altAdminUrl].filter(
    (origin): origin is string => !!origin,
  );

  return isDeployed(nodeEnv) ? deployed : [...deployed, LOCALHOST_ORIGIN];
}
