import { expect, it, mock, spyOn } from "bun:test";
import { applyTaskBadgePush } from "./taskBadgePush";

const badgePush = {
  notification: null,
  data: { dataString: '{"taskBadgeCount":2}' },
};

const apply = (params: {
  payload: Parameters<typeof applyTaskBadgePush>[0]["payload"];
  appActive: boolean;
  signedIn?: boolean;
}) => {
  const setBadge = mock(async (_count: number) => {});
  const refetch = mock(() => {});
  return {
    setBadge,
    refetch,
    applied: applyTaskBadgePush({
      payload: params.payload,
      appActive: params.appActive,
      signedIn: async () => params.signedIn ?? true,
      setBadge,
      refetch,
    }),
  };
};

it("sets the icon from a badge push while the app is in the background", async () => {
  const { setBadge, refetch, applied } = apply({
    payload: badgePush,
    appActive: false,
  });
  await applied;

  expect(setBadge).toHaveBeenCalledWith(2);
  expect(refetch).not.toHaveBeenCalled();
});

it("refetches instead while the app is in the foreground", async () => {
  const { setBadge, refetch, applied } = apply({
    payload: badgePush,
    appActive: true,
  });
  await applied;

  expect(refetch).toHaveBeenCalledTimes(1);
  expect(setBadge).not.toHaveBeenCalled();
});

it("ignores a push that isn't a badge push", async () => {
  const { setBadge, refetch, applied } = apply({
    payload: { notification: null, data: { screen: "/messages" } },
    appActive: false,
  });
  await applied;

  expect(setBadge).not.toHaveBeenCalled();
  expect(refetch).not.toHaveBeenCalled();
});

it("leaves the icon alone while signed out", async () => {
  const { setBadge, applied } = apply({
    payload: badgePush,
    appActive: false,
    signedIn: false,
  });
  await applied;

  expect(setBadge).not.toHaveBeenCalled();
});

it("reports a data string that isn't JSON and leaves the icon alone", async () => {
  const logged = spyOn(console, "error").mockImplementation(() => {});
  const { setBadge, refetch, applied } = apply({
    payload: { notification: null, data: { dataString: "{" } },
    appActive: false,
  });
  await applied;

  expect(logged).toHaveBeenCalledTimes(1);
  expect(setBadge).not.toHaveBeenCalled();
  expect(refetch).not.toHaveBeenCalled();
  logged.mockRestore();
});
