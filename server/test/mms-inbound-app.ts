import { EventLogService } from "src/eventlog/eventlog.service";
import { MmsModule } from "src/mms/mms.module";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

/** Registers hooks that start the MMS app and wait for its event logs to
 * finish writing after each test, so call it once at a spec file's top level.
 * The helpers it returns work only inside hooks and tests. */
export function mmsInboundApp() {
  let ctx: TestContext;
  const pendingEventLogs = new Set<
    ReturnType<EventLogService["sendMessage"]>
  >();

  const drainEventLogs = async (): Promise<void> => {
    await Promise.allSettled([...pendingEventLogs]);
  };

  beforeAll(async () => {
    ctx = await createTestApp([MmsModule]);
    const eventLogService = ctx.app.get(EventLogService);
    const sendMessage = eventLogService.sendMessage.bind(eventLogService);
    jest.spyOn(eventLogService, "sendMessage").mockImplementation((data) => {
      const pending = sendMessage(data);
      pendingEventLogs.add(pending);
      void pending.then(
        () => pendingEventLogs.delete(pending),
        () => pendingEventLogs.delete(pending),
      );
      return pending;
    });
  });

  afterEach(async () => {
    await drainEventLogs();
  });

  afterAll(async () => {
    await drainEventLogs();
    await closeTestApp(ctx.app);
  });

  return { ctx: () => ctx, drainEventLogs };
}
