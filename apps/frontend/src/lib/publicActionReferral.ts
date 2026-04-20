interface NonmemberPublicReferralActionParams {
  referralCode: string | null;
  isAuthenticated: boolean;
  userLoading?: boolean;
}

export function isNonmemberOnPublicActionReferral({
  referralCode,
  isAuthenticated,
  userLoading = false,
}: NonmemberPublicReferralActionParams): boolean {
  if (userLoading) {
    return false;
  }

  if (!referralCode) {
    return false;
  }

  return !isAuthenticated;
}
