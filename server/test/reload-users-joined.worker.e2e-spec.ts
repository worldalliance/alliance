import { Logger } from "@nestjs/common";
import { milliseconds } from "date-fns";
import { ActionParticipantsService } from "../src/actions/action-participants.service";
import { ReloadUsersJoinedWorker } from "../src/actions/reload-users-joined.worker";
import { createTestApp, TestContext } from "./e2e-test-utils";

describe("ReloadUsersJoinedWorker (e2e)", () => {
  let ctx: TestContext;
  let worker: ReloadUsersJoinedWorker;
  let participants: ActionParticipantsService;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    worker = ctx.app.get(ReloadUsersJoinedWorker);
    participants = ctx.app.get(ActionParticipantsService);
  }, 50000);

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await ctx.app.close();
  });

  it("skips a run that starts while another holds the lock", async () => {
    const { promise: release, resolve: finish } = Promise.withResolvers<void>();
    const { promise: started, resolve: start } = Promise.withResolvers<void>();
    const reload = jest
      .spyOn(participants, "reloadAllActionUsersJoined")
      .mockImplementation(async () => {
        start();
        await release;
      });
    const log = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => {});

    const first = worker.reloadAllActionUsersJoined();
    await started;
    await worker.reloadAllActionUsersJoined();
    const callsWhileHeld = reload.mock.calls.length;
    finish();
    await first;
    await worker.reloadAllActionUsersJoined();

    expect({ callsWhileHeld, calls: reload.mock.calls.length }).toEqual({
      callsWhileHeld: 1,
      calls: 2,
    });
    expect(log).toHaveBeenCalledWith("usersJoined reload skipped bc of lock");
  });

  it("logs a failed run instead of rejecting", async () => {
    const failure = new Error("reload failed");
    jest
      .spyOn(participants, "reloadAllActionUsersJoined")
      .mockRejectedValue(failure);
    const error = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});

    await worker.reloadAllActionUsersJoined();

    expect(error).toHaveBeenCalledWith("usersJoined reload failed", failure);
  });

  it("warns when a run outlasts its interval", async () => {
    const startedAt = Date.now();
    jest
      .spyOn(participants, "reloadAllActionUsersJoined")
      .mockImplementation(async () => {
        jest
          .spyOn(Date, "now")
          .mockReturnValue(startedAt + milliseconds({ minutes: 11 }));
      });
    const warn = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => {});

    await worker.reloadAllActionUsersJoined();

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("longer than its interval"),
    );
  });
});
