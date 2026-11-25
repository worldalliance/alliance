import { R } from "@alliance/common/result";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { memoryAsyncStorage } from "./memoryAsyncStorage";
import {
  canTakeResumeRoute,
  reloadResumingAt,
  RESUME_ROUTE_MAX_AGE_MS,
  ResumeRouteStep,
  resumeSavedRoute,
  saveResumeRoute,
  takeResumeRoute,
} from "./resumeRoute";

beforeEach(memoryAsyncStorage);
afterEach(() => jest.restoreAllMocks());

describe("resume route", () => {
  it("returns the saved route once", async () => {
    await saveResumeRoute("/actions/7", 1000);
    expect(await takeResumeRoute(2000)).toEqual(R.success("/actions/7"));
    expect(await takeResumeRoute(2000)).toEqual(R.success(null));
  });

  it("drops a route saved too long ago", async () => {
    await saveResumeRoute("/actions/7", 0);
    expect(await takeResumeRoute(RESUME_ROUTE_MAX_AGE_MS + 1)).toEqual(
      R.success(null),
    );
  });

  it.each(["https://evil.example", "//evil.example", "actions/7"])(
    "fails on %s, which isn't an in-app path",
    async (route) => {
      await saveResumeRoute(route, 0);
      expect(R.isFailure(await takeResumeRoute(0))).toBe(true);
      expect(await takeResumeRoute(0)).toEqual(R.success(null));
    },
  );

  it("fails on an unreadable entry", async () => {
    await AsyncStorage.setItem("resumeRoute", "{not json");
    expect(R.isFailure(await takeResumeRoute(0))).toBe(true);
  });

  it("fails when storage does", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("disk"));
    expect(R.isFailure(await takeResumeRoute(0))).toBe(true);
  });
});

describe("resumeSavedRoute", () => {
  const resume = (isAuthenticated: boolean) => {
    const navigate = jest.fn();
    const report = jest.fn();
    return {
      navigate,
      report,
      done: resumeSavedRoute({ isAuthenticated, navigate, report, now: 0 }),
    };
  };

  it("opens the saved route for a signed-in member", async () => {
    await saveResumeRoute("/actions/7", 0);
    const { navigate, report, done } = resume(true);
    await done;
    expect(navigate).toHaveBeenCalledWith("/actions/7");
    expect(report).not.toHaveBeenCalled();
  });

  it("consumes the route without opening it when signed out", async () => {
    await saveResumeRoute("/actions/7", 0);
    const { navigate, done } = resume(false);
    await done;
    expect(navigate).not.toHaveBeenCalled();
    expect(await takeResumeRoute(0)).toEqual(R.success(null));
  });

  it("reports a storage failure", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValue(new Error("disk"));
    const { navigate, report, done } = resume(true);
    await done;
    expect(report).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("canTakeResumeRoute", () => {
  it.each([
    { isLoading: true, sessionUnavailable: false, takes: false },
    { isLoading: false, sessionUnavailable: true, takes: false },
    { isLoading: false, sessionUnavailable: false, takes: true },
  ])(
    "with auth loading $isLoading and the session unavailable $sessionUnavailable, takes the route: $takes",
    ({ takes, ...auth }) => {
      expect(canTakeResumeRoute(auth)).toBe(takes);
    },
  );
});

describe("reloadResumingAt", () => {
  const reloadWith = (reload: () => Promise<void>) => {
    const report = jest.fn();
    return {
      report,
      done: reloadResumingAt({ route: "/actions/7", reload, report }),
    };
  };

  it("saves the route before reloading", async () => {
    let savedAtReload: unknown = null;
    const { done } = reloadWith(async () => {
      savedAtReload = await takeResumeRoute();
    });
    expect(await done).toEqual(R.success(undefined));
    expect(savedAtReload).toEqual(R.success("/actions/7"));
  });

  it("reports a failed save and reloads anyway", async () => {
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValue(new Error("disk"));
    const reload = jest.fn(async () => {});
    const { report, done } = reloadWith(reload);
    await done;
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ step: ResumeRouteStep.Save }),
    );
    expect(reload).toHaveBeenCalled();
  });

  it("drops the route when the reload fails", async () => {
    const { done } = reloadWith(async () => {
      throw new Error("no update");
    });
    expect(R.isFailure(await done)).toBe(true);
    expect(await takeResumeRoute()).toEqual(R.success(null));
  });

  it("reports a failed drop after a failed reload", async () => {
    jest.spyOn(AsyncStorage, "removeItem").mockRejectedValue(new Error("disk"));
    const { report, done } = reloadWith(async () => {
      throw new Error("no update");
    });
    await done;
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ step: ResumeRouteStep.Drop }),
    );
  });
});
