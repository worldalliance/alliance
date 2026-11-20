import { MmsService } from "src/mms/mms.service";
import supertest from "supertest";
import { mmsThreadApp } from "./mms-thread-app";

const {
  ctx,
  mmsRepo,
  userRepo,
  server,
  admin,
  inbound,
  thread,
  send,
  createMember,
} = mmsThreadApp();

describe("Opt-out per number (e2e)", () => {
  it("refuses staff texts while only a member's old flag says the number opted out", async () => {
    const member = await createMember("+14155558730");
    await userRepo().update(
      { id: member.id },
      { phoneNumberUnsubscribed: true },
    );

    expect((await thread(member.id).expect(200)).body.optedOut).toBe(true);
    await send(member.id, "Hello").expect(409);
  });

  it("refuses staff texts when an old flag says STOP after the number's state said START", async () => {
    const member = await createMember("+14155558734");
    await inbound({ from: "+14155558734", body: "START" });
    await userRepo().update(
      { id: member.id },
      { phoneNumberUnsubscribed: true },
    );

    expect((await thread(member.id).expect(200)).body.optedOut).toBe(true);
    await send(member.id, "Hello").expect(409);
  });

  it("lets staff text a member again after their number sends STOP then START", async () => {
    const member = await createMember("+14155558735");
    await inbound({ from: "+14155558735", body: "STOP" });
    await inbound({ from: "+14155558735", body: "START" });

    expect((await thread(member.id).expect(200)).body.optedOut).toBe(false);
    await send(member.id, "Hello").expect(201);
  });

  it("opts out every account on a number, including one made after the STOP", async () => {
    await inbound({ from: "+14155558731", body: "STOP" });
    const member = await createMember("+14155558731");

    expect((await thread(member.id).expect(200)).body.optedOut).toBe(true);
    await send(member.id, "Hello").expect(409);
  });

  it("leaves out of Needs reply a member whose number opted out before they joined", async () => {
    await inbound({ from: "+14155558733", body: "STOP" });
    const member = await createMember("+14155558733");
    await inbound({ from: "+14155558733", body: "hello?" });

    const { body } = await supertest(server())
      .get("/mms-threads/needs-reply")
      .set("Authorization", admin())
      .expect(200);
    expect(body.map((entry: { userId: number }) => entry.userId)).not.toContain(
      member.id,
    );
  });

  it("sends no automated text to a number that opted out", async () => {
    const member = await createMember("+14155558732");
    await inbound({ from: "+14155558732", body: "STOP" });

    const sent = await ctx().app.get(MmsService).sendMms({
      to: "+14155558732",
      userId: member.id,
      body: "New action live",
      mediaUrls: [],
      tracking: null,
    });

    expect(sent).toBeNull();
    expect(
      await mmsRepo().countBy({ to: "+14155558732", body: "New action live" }),
    ).toBe(0);
  });
});
