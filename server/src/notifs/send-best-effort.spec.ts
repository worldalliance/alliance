import { Logger } from "@nestjs/common";
import { sendBestEffort } from "./send-best-effort";

describe("sendBestEffort", () => {
  it("logs a failed send instead of rejecting", async () => {
    const logger = new Logger("test");
    const log = jest.spyOn(logger, "error").mockImplementation();
    const error = new Error("carrier down");
    await sendBestEffort({
      logger,
      what: "text to user 7",
      send: () => Promise.reject(error),
    });
    expect(log).toHaveBeenCalledWith("Failed to send text to user 7", error);
  });

  it("logs nothing when the send succeeds", async () => {
    const logger = new Logger("test");
    const log = jest.spyOn(logger, "error").mockImplementation();
    await sendBestEffort({
      logger,
      what: "text to user 7",
      send: () => Promise.resolve(),
    });
    expect(log).not.toHaveBeenCalled();
  });
});
