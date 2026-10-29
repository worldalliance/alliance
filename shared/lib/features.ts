export enum Features {
  Forum = "forum",
  PublicSignup = "public_signup",
  Messaging = "messaging",
  GeneralUpdatesLink = "general_updates_link",
  TaskFlow = "task_flow",
}

export const PROD_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: true,
  [Features.PublicSignup]: false,
  [Features.Messaging]: true,
  [Features.GeneralUpdatesLink]: false,
  [Features.TaskFlow]: false,
};

export const DEV_FLAGS: Record<Features, boolean> = {
  [Features.Forum]: true,
  [Features.PublicSignup]: false,
  [Features.Messaging]: true,
  [Features.GeneralUpdatesLink]: true,
  [Features.TaskFlow]: true,
};

export const isEnabled = (feature: Features, env: string) => {
  if (env === "development" || env === "staging") {
    return DEV_FLAGS[feature];
  }
  return PROD_FLAGS[feature];
};
