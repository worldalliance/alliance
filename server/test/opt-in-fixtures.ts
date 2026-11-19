import { Mms } from "src/mms/mms.entity";
import { MmsService } from "src/mms/mms.service";
import type { TestContext } from "./e2e-test-utils";

/** Stubs sendMms with one that saves its Mms row, so an opt-in can link to it. */
export function stubSavedSend(ctx: TestContext): jest.SpyInstance {
  const mmsRepo = ctx.dataSource.getRepository(Mms);
  return jest
    .spyOn(ctx.app.get(MmsService), "sendMms")
    .mockImplementation(async ({ to, userId, body }) =>
      mmsRepo.save(
        mmsRepo.create({
          to,
          from: "+15555550100",
          body,
          status: "sent",
          twilioSid: `opt-in-${userId}`,
        }),
      ),
    );
}
