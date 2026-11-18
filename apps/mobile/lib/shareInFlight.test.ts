import { shareInFlight } from "./shareInFlight";

describe("shareInFlight", () => {
  it("runs once for concurrent callers and again after it settles", async () => {
    const run = jest.fn(async () => 1);
    const shared = shareInFlight(run);
    const [a, b] = [shared(), shared()];
    expect(a).toBe(b);
    await a;
    expect(run).toHaveBeenCalledTimes(1);
    await shared();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs again after a rejection", async () => {
    const run = jest.fn(async () => {
      throw new Error("offline");
    });
    const shared = shareInFlight(run);
    await expect(shared()).rejects.toThrow("offline");
    await expect(shared()).rejects.toThrow("offline");
    expect(run).toHaveBeenCalledTimes(2);
  });
});
