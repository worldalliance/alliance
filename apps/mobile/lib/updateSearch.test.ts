import { R } from "@alliance/common/result";
import { searchForNewerVersion, UpdateSearchOutcome } from "./updateSearch";

const ok = (value: boolean) => async () => R.success(value);
const failed = async () => R.failure(new Error("offline"));

describe("searchForNewerVersion", () => {
  it.each([
    [UpdateSearchOutcome.Downloaded, ok(true), ok(true)],
    [UpdateSearchOutcome.InStore, ok(false), ok(true)],
    [UpdateSearchOutcome.None, ok(false), ok(false)],
    [UpdateSearchOutcome.InStore, failed, ok(true)],
    [UpdateSearchOutcome.Failed, failed, ok(false)],
    [UpdateSearchOutcome.Failed, ok(false), failed],
  ])("returns %s (case %#)", async (outcome, fetchOta, storeHasNewer) => {
    expect(await searchForNewerVersion({ fetchOta, storeHasNewer })).toBe(
      outcome,
    );
  });

  it("skips the store once an update is downloaded", async () => {
    const storeHasNewer = jest.fn(ok(true));
    await searchForNewerVersion({ fetchOta: ok(true), storeHasNewer });
    expect(storeHasNewer).not.toHaveBeenCalled();
  });
});
