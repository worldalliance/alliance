import { currentNodeEnv, NodeEnv } from "@alliance/common/node-env";

const REFUSES_REVIEW_ACCOUNTS: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: true,
  [NodeEnv.Staging]: false,
  [NodeEnv.Development]: false,
  [NodeEnv.Test]: false,
};

/** Whether this deployment keeps `isTestUser` accounts out. An unknown
 * NODE_ENV refuses them. */
export function refusesReviewAccounts(): boolean {
  const env = currentNodeEnv();
  return !env.ok || REFUSES_REVIEW_ACCOUNTS[env.value];
}

export function isRefusedReviewAccount(user: { isTestUser: boolean }): boolean {
  return user.isTestUser && refusesReviewAccounts();
}
