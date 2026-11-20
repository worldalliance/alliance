import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { describe, expect, it } from "bun:test";
import type { Response } from "express";
import { CohortDecisionListener } from "src/actions/cohort-decision.listener";
import { CohortDecisionService } from "src/actions/cohort-decision.service";
import { ContractEvents } from "src/contract/contract.events";
import { configureApp } from "src/utils/configure-app";

const events: string[] = [];

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
    CohortDecisionListener,
    {
      provide: CohortDecisionService,
      useValue: {
        resolveForUser: async (userId: number) => {
          await Bun.sleep(50);
          events.push(`resolved ${userId}`);
        },
      },
    },
  ],
})
class ShutdownModule {}

describe("shutdown", () => {
  it("drains the listener work of a request still in flight when shutdown starts, within pm2's kill timeout", async () => {
    const app = await NestFactory.create<NestExpressApplication>(
      ShutdownModule,
      { logger: false },
    );
    configureApp(app);
    const eventEmitter = app.get(EventEmitter2);
    const arrived = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    app.use("/sign", async (_req: unknown, res: Response) => {
      arrived.resolve();
      await release.promise;
      eventEmitter.emit(ContractEvents.Signed, { userId: 7 });
      res.send("signed");
    });
    await app.listen(0, "127.0.0.1");
    const response = fetch(`${await app.getUrl()}/sign`).then((res) =>
      res.text(),
    );
    await arrived.promise;

    // closeTestApp would destroy the in-flight request this test keeps.
    // eslint-disable-next-line test-app/close
    const closed = app.close().then(() => events.push("closed"));
    await Bun.sleep(100);
    const releasedAt = performance.now();
    release.resolve();

    expect(await response).toBe("signed");
    await closed;
    expect(events).toEqual(["resolved 7", "closed"]);
    expect(performance.now() - releasedAt).toBeLessThan(1000);
  });
});
