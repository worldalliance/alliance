import {
  Notification,
  NotificationCategory,
} from "src/notifs/entities/notification.entity";
import { notifMessage } from "src/notifs/notification-content";
import { NotifsService } from "src/notifs/notifs.service";
import { User } from "src/user/entities/user.entity";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { rendezvous } from "./rendezvous";

describe("NotifsService.sendNotifOnce (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const saveRecipient = (email: string) => {
    const userRepo = ctx.dataSource.getRepository(User);
    return userRepo.save(
      userRepo.create({
        name: "Once Recipient",
        email,
        password: "Password123!",
      }),
    );
  };

  const sendOnce = (user: User, groupingKey: string) =>
    ctx.app.get(NotifsService).sendNotifOnce({
      user,
      category: NotificationCategory.FriendRequest,
      message: notifMessage`Sent once`,
      destination: null,
      webAppLocation: "/",
      associatedUsers: [],
      groupingKey,
    });

  it("saves one notification when two callers send the same grouping key at once", async () => {
    const recipient = await saveRecipient("send-once@example.com");
    const notifs = ctx.app.get(NotifsService);
    const createNotif = notifs.createNotif.bind(notifs);
    const bothBuilt = rendezvous({ parties: 2, timeoutMs: 5000 });
    let built = 0;
    const spy = jest
      .spyOn(notifs, "createNotif")
      .mockImplementation(async (...args) => {
        const row = await createNotif(...args);
        built += 1;
        await bothBuilt();
        return row;
      });

    const send = () => sendOnce(recipient, "send-once-test");
    await Promise.all([send(), send()]);
    spy.mockRestore();

    expect(built).toBe(2);
    expect(
      await ctx.dataSource
        .getRepository(Notification)
        .countBy({ groupingKey: "send-once-test" }),
    ).toBe(1);
  });

  it("saves one notification per recipient sharing a grouping key, and none on a later call", async () => {
    const first = await saveRecipient("send-once-first@example.com");
    const second = await saveRecipient("send-once-second@example.com");

    await Promise.all([
      sendOnce(first, "send-once-shared"),
      sendOnce(second, "send-once-shared"),
    ]);
    await sendOnce(first, "send-once-shared");

    const notifRepo = ctx.dataSource.getRepository(Notification);
    for (const recipient of [first, second]) {
      expect(
        await notifRepo.countBy({
          groupingKey: "send-once-shared",
          user: { id: recipient.id },
        }),
      ).toBe(1);
    }
  });
});
