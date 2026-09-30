export const WAITLIST_PATH = "/projects/democratic-grantmaking-26";
export const WAITLIST_LINK_PARAM = "link";
export const WAITLIST_REFERRER_PARAM = "ref";

export const waitlistShareUrl = (baseUrl: string, code: string): string =>
  `${baseUrl}${WAITLIST_PATH}?${new URLSearchParams({ [WAITLIST_REFERRER_PARAM]: code })}`;
