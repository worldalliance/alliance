import { Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { emitThreadChanged, MmsEvents } from "./mms.events";

it("logs a listener's error instead of failing the committed write", () => {
  const eventEmitter = new EventEmitter2();
  eventEmitter.on(MmsEvents.ThreadChanged, () => {
    throw new Error("no socket server");
  });
  const log = jest.spyOn(Logger.prototype, "error").mockImplementation();

  expect(() =>
    emitThreadChanged(eventEmitter, {
      phoneNumber: "+14155550001",
      needsReplyChanged: true,
    }),
  ).not.toThrow();
  expect(log).toHaveBeenCalled();
  log.mockRestore();
});
