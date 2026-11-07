import { generatePath, matchPath } from "react-router";

type RoutePair = { member: string; admin: string };

// Matching ignores trailing segments, so each pair follows every pair whose path extends its own.
const BOTH_WAYS: RoutePair[] = [
  { member: "/actions/:id", admin: "/actions/:id" },
  { member: "/member/:id", admin: "/member/:id" },
  { member: "/forum/post/:id", admin: "/posts/:id" },
  { member: "/groups", admin: "/groups" },
  { member: "/members", admin: "/members" },
  { member: "/general-updates", admin: "/general-updates" },
  { member: "/action-updates", admin: "/action-updates" },
  { member: "/actions", admin: "/actions" },
  { member: "/forum", admin: "/posts" },
];

const MEMBER_TO_ADMIN: RoutePair[] = [
  { member: "/feed/:id", admin: "/actions/:id" },
  { member: "/forum/edit/:id", admin: "/posts/:id" },
  ...BOTH_WAYS,
];

const ADMIN_TO_MEMBER: RoutePair[] = [
  { member: "/actions", admin: "/actions/new" },
  ...BOTH_WAYS,
];

const translate = ({
  pathname,
  pairs,
  from,
  to,
  fallback,
}: {
  pathname: string;
  pairs: RoutePair[];
  from: keyof RoutePair;
  to: keyof RoutePair;
  fallback: string;
}): string => {
  for (const pair of pairs) {
    const match = matchPath({ path: pair[from], end: false }, pathname);
    if (match) return generatePath(pair[to], match.params);
  }
  return fallback;
};

/** The admin panel page for what the member zone shows at `pathname`. */
export const adminPathFor = (pathname: string): string =>
  translate({
    pathname,
    pairs: MEMBER_TO_ADMIN,
    from: "member",
    to: "admin",
    fallback: "/",
  });

/** The member zone page for what the admin panel shows at `pathname`. */
export const memberPathFor = (pathname: string): string =>
  translate({
    pathname,
    pairs: ADMIN_TO_MEMBER,
    from: "admin",
    to: "member",
    fallback: "/tasks",
  });
