export enum Features {
  Forum = "forum",
  PublicSignup = "public_signup",
  BugReporting = "bug_reporting",
  Messaging = "messaging",
}

export const PROD_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: true,
  [Features.PublicSignup]: false,
  [Features.BugReporting]: false,
  [Features.Messaging]: true,
};

export const DEV_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: true,
  [Features.PublicSignup]: false,
  [Features.BugReporting]: false,
  [Features.Messaging]: true,
};

export const isEnabled = (feature: Features, env: string) => {
  if (env === "development" || env === "staging") {
    return DEV_FLAGS[feature];
  }
  return PROD_FLAGS[feature];
};
