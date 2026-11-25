import { setEnv } from "@alliance/common/set-env";
import { getSitePageUrl } from "./config";
import { openLink } from "./openLink";

const originalPort = process.env.EXPO_PUBLIC_ALLIANCE_API_PORT;
beforeAll(() => {
  process.env.EXPO_PUBLIC_ALLIANCE_API_PORT = "4005";
});
afterAll(() => {
  setEnv("EXPO_PUBLIC_ALLIANCE_API_PORT", originalPort);
});

const opened = (url: string) => {
  const pushed: string[] = [];
  const openedUrls: string[] = [];
  openLink(url, {
    push: (route) => void pushed.push(route),
    openURL: async (target) => void openedUrls.push(target),
  });
  return { pushed, openedUrls };
};

it.each(["faq?t=10:30", "/about#step:2"])(
  "opens relative link %p on the site",
  (url) => {
    expect(opened(url)).toEqual({
      pushed: [],
      openedUrls: [getSitePageUrl(url)],
    });
  },
);

it("opens a link with a scheme as it is", () => {
  expect(opened("mailto:hi@example.org").openedUrls).toEqual([
    "mailto:hi@example.org",
  ]);
});

it("pushes a link with an app screen", () => {
  expect(opened("/actions/12/activity/34")).toEqual({
    pushed: ["/actions/12/activity/34"],
    openedUrls: [],
  });
});
