import type { Expo, ExpoPushReceipt } from "expo-server-sdk";
import { MessagingModule } from "src/messaging/messaging.module";
import { Push } from "src/push/push.entity";
import { EXPO_CLIENT, PushService } from "src/push/push.service";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("Push (e2e)", () => {
  let ctx: TestContext;
  let pushRepo: Repository<Push>;
  let pushService: PushService;
  let expo: Expo;
  let user: User;
  let counter = 0;

  const createPush = (overrides: Partial<Push> = {}): Promise<Push> => {
    counter += 1;
    return pushRepo.save(
      pushRepo.create({
        user,
        expoPushToken: `ExponentPushToken[push_spec_${counter}]`,
        body: "hello",
        idempotencyKey: `push-spec-${Date.now()}-${counter}`,
        ...overrides,
      }),
    );
  };

  const reload = (id: number) =>
    pushRepo.findOneOrFail({ where: { id }, withDeleted: true });

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule]);
    pushRepo = ctx.dataSource.getRepository(Push);
    pushService = ctx.app.get(PushService);
    expo = ctx.app.get<Expo>(EXPO_CLIENT);
    const userRepo = ctx.dataSource.getRepository(User);
    user = await userRepo.save(
      userRepo.create({
        name: "Push Spec User",
        email: "pushspecuser@example.com",
        password: "pass",
        tags: [ctx.defaultTag],
      }),
    );
  }, 50000);

  afterAll(async () => {
    if (ctx?.app) {
      await ctx.app.close();
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("queryExpoStatuses", () => {
    it("writes receipts to live pushes and leaves soft-deleted ones alone", async () => {
      const ok = await createPush({
        receiptId: "spec-ok",
        receiptStatus: "pending",
      });
      const failed = await createPush({
        receiptId: "spec-error",
        receiptStatus: "pending",
      });
      const noReceipt = await createPush({
        receiptId: "spec-none",
        receiptStatus: "pending",
      });
      const deletedResolved = await createPush({
        receiptId: "spec-deleted-ok",
        receiptStatus: "pending",
      });
      const deletedUnresolved = await createPush({
        receiptId: "spec-deleted-none",
        receiptStatus: "pending",
      });

      const receipts: Record<string, ExpoPushReceipt> = {
        "spec-ok": { status: "ok" },
        "spec-error": {
          status: "error",
          message: "gone",
          details: { error: "DeviceNotRegistered" },
        },
        "spec-deleted-ok": { status: "ok" },
      };
      jest
        .spyOn(expo, "getPushNotificationReceiptsAsync")
        .mockImplementation(async (ids) => {
          await pushRepo.softDelete([deletedResolved.id, deletedUnresolved.id]);
          return Object.fromEntries(
            ids.flatMap((id) => (receipts[id] ? [[id, receipts[id]]] : [])),
          );
        });

      await pushService.queryExpoStatuses();

      const okAfter = await reload(ok.id);
      expect(okAfter.receiptStatus).toBe("ok");
      expect(okAfter.lastCheckedStatusAt).not.toBeNull();

      const failedAfter = await reload(failed.id);
      expect(failedAfter).toMatchObject({
        receiptStatus: "error",
        errorCode: "DeviceNotRegistered",
        errorMessage: "gone",
      });
      expect(failedAfter.lastCheckedStatusAt).not.toBeNull();

      const noReceiptAfter = await reload(noReceipt.id);
      expect(noReceiptAfter.receiptStatus).toBe("pending");
      expect(noReceiptAfter.lastCheckedStatusAt).not.toBeNull();

      for (const deleted of [deletedResolved, deletedUnresolved]) {
        const after = await reload(deleted.id);
        expect(after.deletedAt).not.toBeNull();
        expect(after.receiptStatus).toBe("pending");
        expect(after.lastCheckedStatusAt).toBeNull();
      }
    });
    it("expires stale live pushes and leaves soft-deleted ones alone", async () => {
      const stale = await createPush({
        receiptId: "spec-stale",
        receiptStatus: "pending",
      });
      const deletedStale = await createPush({
        receiptId: "spec-deleted-stale",
        receiptStatus: "pending",
      });
      const longAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      await pushRepo.update([stale.id, deletedStale.id], {
        createdAt: longAgo,
      });
      await pushRepo.softDelete(deletedStale.id);
      jest
        .spyOn(expo, "getPushNotificationReceiptsAsync")
        .mockResolvedValue({});

      await pushService.queryExpoStatuses();

      expect((await reload(stale.id)).receiptStatus).toBe("expired");
      expect((await reload(deletedStale.id)).receiptStatus).toBe("pending");
    });
  });

  describe("POST /push/opened", () => {
    const markOpened = (cid: number) =>
      request(ctx.app.getHttpServer())
        .post("/push/opened")
        .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, user)}`)
        .send({ cid });

    it("marks a live push opened", async () => {
      const push = await createPush();
      await markOpened(push.id).expect(201);
      expect((await reload(push.id)).openedAt).not.toBeNull();
    });

    it("404s on a soft-deleted push and leaves it deleted", async () => {
      const push = await createPush();
      await pushRepo.softDelete(push.id);
      await markOpened(push.id).expect(404);
      const after = await reload(push.id);
      expect(after.deletedAt).not.toBeNull();
      expect(after.openedAt).toBeNull();
    });
  });
});
