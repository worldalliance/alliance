import { generatePath, matchPath } from "react-router";

type RoutePair = { member: string; admin: string };

const BOTH_WAYS: RoutePair[] = [
  { member: "/actions/:id", admin: "/actions/:id" },
  { member: "/member/:id", admin: "/member/:id" },
  { member: "/forum/post/:id", admin: "/posts/:id" },
  { member: "/groups", admin: "/groups" },
  { member: "/members", admin: "/members" },
  { member: "/general-updates", admin: "/general-updates" },
];

const MEMBER_TO_ADMIN: RoutePair[] = [
  ...BOTH_WAYS,
  { member: "/feed/:id", admin: "/actions/:id" },
  { member: "/forum/edit/:id", admin: "/posts/:id" },
];

const translate = ({
  pathname,
  pairs,
  from,
  fallback,
}: {
  pathname: string;
  pairs: RoutePair[];
  from: keyof RoutePair;
  fallback: string;
}): string => {
  const to = from === "member" ? "admin" : "member";
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
    fallback: "/",
  });

/** The member zone page for what the admin panel shows at `pathname`. */
export const memberPathFor = (pathname: string): string =>
  translate({ pathname, pairs: BOTH_WAYS, from: "admin", fallback: "/tasks" });
