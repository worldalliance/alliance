import { MmsThread } from "src/mms/mms-thread.entity";
import { mmsThreadApp } from "./mms-thread-app";

const { ctx, inbound, send, createMember } = mmsThreadApp();

const threadRow = (phoneNumber: string) =>
  ctx().dataSource.getRepository(MmsThread).findOneBy({ phoneNumber });

describe("Thread rows (e2e)", () => {
  it("records a row for a number that texts in and for one staff text", async () => {
    await inbound({ from: "+14155558740", body: "Hi" }).expect(201);
    const member = await createMember("+14155558741");
    await send(member.id, "Hello").expect(201);

    expect(await threadRow("+14155558740")).not.toBeNull();
    expect(await threadRow("+14155558741")).not.toBeNull();
  });
});
