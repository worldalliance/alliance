/** Build the signup URL for a onetime invite or referral code. */
export function getOnetimeInviteSignupUrl(
  baseUrl: string,
  code: string,
): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/signup?ref=${code}`;
}

/** Alias for invite/referral signup URL; same as getOnetimeInviteSignupUrl. */
export const getReferralSignupUrl = getOnetimeInviteSignupUrl;

/** The homepage, carrying a code its "Accept invite" passes on to signup. */
export function getInviteLandingUrl(baseUrl: string, code: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/?ref=${encodeURIComponent(code)}`;
}
