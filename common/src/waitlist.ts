export const WAITLIST_PATH = "/projects/democratic-grantmaking-26";
export const WAITLIST_LINK_PARAM = "link";
export const WAITLIST_REFERRER_PARAM = "ref";

const waitlistUrl = (baseUrl: string, param: string, code: string): string =>
  `${baseUrl}${WAITLIST_PATH}?${new URLSearchParams({ [param]: code })}`;

export const waitlistShareUrl = (baseUrl: string, code: string): string =>
  waitlistUrl(baseUrl, WAITLIST_REFERRER_PARAM, code);

export const waitlistLinkUrl = (baseUrl: string, code: string): string =>
  waitlistUrl(baseUrl, WAITLIST_LINK_PARAM, code);

export const WAITLIST_UNSUBSCRIBE_PATH = "/waitlist/unsubscribe";
export const WAITLIST_UNSUBSCRIBE_PARAM = "token";

export const waitlistUnsubscribeUrl = (
  baseUrl: string,
  token: string,
): string =>
  `${baseUrl}${WAITLIST_UNSUBSCRIBE_PATH}?${new URLSearchParams({ [WAITLIST_UNSUBSCRIBE_PARAM]: token })}`;
