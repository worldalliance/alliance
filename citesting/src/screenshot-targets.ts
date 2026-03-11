export type ScreenshotTarget = {
  name: string;
  path: string;
  requiresAuth?: boolean;
  waitForSelector?: string;
  waitForTimeoutMs?: number;
};

export const screenshotTargets: ScreenshotTarget[] = [
  // Public routes
  { name: "home", path: "/" },
  { name: "guide", path: "/guide" },
  { name: "people", path: "/people" },
  { name: "foundation", path: "/foundation" },
  { name: "governance", path: "/governance" },
  { name: "faq", path: "/faq" },
  { name: "progress", path: "/progress" },
  // Authenticated routes
  { name: "tasks", path: "/tasks", requiresAuth: true },
  { name: "actions", path: "/actions", requiresAuth: true },
  { name: "action", path: "/actions/74", requiresAuth: true },
  { name: "post", path: "/forum/post/5", requiresAuth: true },
  { name: "feed", path: "/feed", requiresAuth: true },
  { name: "forum", path: "/forum", requiresAuth: true },
  { name: "invites", path: "/invites", requiresAuth: true },
  { name: "contract", path: "/contract", requiresAuth: true },
  { name: "messages", path: "/messages", requiresAuth: true },
  { name: "settings", path: "/settings", requiresAuth: true },
  { name: "notifications", path: "/notifications", requiresAuth: true },
  { name: "members", path: "/members", requiresAuth: true },
  { name: "profile", path: "/member/15", requiresAuth: true },
];
