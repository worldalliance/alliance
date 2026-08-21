import { isDeployed, parseNodeEnv } from '@alliance/common/node-env';

const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Adds localhost for known local environments. Unknown NODE_ENV values keep the
 * deployed set so a typo cannot widen socket access.
 */
export function socketCorsOrigins({
  nodeEnv,
  appUrl,
  adminUrl,
}: {
  nodeEnv: string | undefined;
  appUrl: string | undefined;
  adminUrl: string | undefined;
}): (string | RegExp)[] {
  const deployed = [appUrl, adminUrl].filter(
    (origin): origin is string => !!origin,
  );

  const env = parseNodeEnv(nodeEnv);
  const allowLocalhost = env.ok && !isDeployed(env.value);

  return allowLocalhost ? [...deployed, LOCALHOST_ORIGIN] : deployed;
}
