import { NodeEnv } from "@alliance/common/node-env";
import { env } from "../config/env";

const REFUSES_REVIEW_ACCOUNTS: Record<NodeEnv, boolean> = {
  [NodeEnv.Production]: true,
  [NodeEnv.Staging]: false,
  [NodeEnv.Development]: false,
  [NodeEnv.Test]: false,
};

/** Whether this deployment keeps `isTestUser` accounts out. */
export function refusesReviewAccounts(): boolean {
  return REFUSES_REVIEW_ACCOUNTS[env("NODE_ENV")];
}

export function isRefusedReviewAccount(user: { isTestUser: boolean }): boolean {
  return user.isTestUser && refusesReviewAccounts();
}
