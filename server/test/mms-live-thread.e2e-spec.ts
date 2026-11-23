import { StaffTextConflict } from "@alliance/common/staffText";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { randomUUID } from "crypto";
import { io, type Socket } from "socket.io-client";
import { MmsThreadGateway } from "src/mms/mms-thread.gateway";
import { MmsUnsubService } from "src/mms/mms-unsub.service";
import { ReferralSource } from "src/user/entities/user.entity";
import { UserEvents } from "src/user/user.events";
import supertest from "supertest";
import { signAccessToken } from "./e2e-test-utils";
import { mmsThreadApp } from "./mms-thread-app";

const {
  ctx,
  userRepo,
  server,
  admin,
  inbound,
  send,
  sendInThread,
  byId,
  threadIdFor,
  createMember,
  saveBroadcast,
  mmsRepo,
} = mmsThreadApp();

const sendAfter = (userId: number, afterId: number | null | undefined) =>
  supertest(server())
    .post(`/mms-threads/${userId}`)
    .set("Authorization", admin())
    .send({ body: "Hi from the team", afterId });

describe("Staff texts sent over newer texts (e2e)", () => {
  it("refuses a text when the thread has one newer than the sender saw", async () => {
    const member = await createMember("+14155558201");
    const seen = await saveBroadcast("+14155558201");
    await inbound({ from: "+14155558201", body: "Are you there?" }).expect(201);

    const { body } = await sendAfter(member.id, seen.id).expect(409);

    expect(body.error).toBe(StaffTextConflict.NewerTexts);
  });

  it("sends when the sender saw the newest text", async () => {
    const member = await createMember("+14155558202");
    const newest = await saveBroadcast("+14155558202");
    await sendAfter(member.id, newest.id).expect(201);
  });

  it("refuses a sender who saw no texts once the thread has one", async () => {
    const member = await createMember("+14155558203");
    await sendAfter(member.id, null).expect(201);
    await inbound({ from: "+14155558203", body: "Thanks" }).expect(201);
    await sendAfter(member.id, null).expect(409);
  });

  it("refuses a text when another admin replied after the one seen", async () => {
    const member = await createMember("+14155558208");
    const otherAdmin = await createMember(null);
    const seen = await saveBroadcast("+14155558208");
    const reply = await saveBroadcast("+14155558208");
    await mmsRepo().update(reply.id, { sentById: otherAdmin.id });

    const { body } = await sendAfter(member.id, seen.id).expect(409);

    expect(body.error).toBe(StaffTextConflict.NewerTexts);
  });

  it("doesn't count the sender's own texts as new to them", async () => {
    const member = await createMember("+14155558207");
    const seen = await saveBroadcast("+14155558207");
    await sendAfter(member.id, seen.id).expect(201);
    await sendAfter(member.id, seen.id).expect(201);
  });

  it("sends regardless when the sender names no text", async () => {
    const member = await createMember("+14155558204");
    await saveBroadcast("+14155558204");
    await sendAfter(member.id, undefined).expect(201);
  });

  it("refuses a sender whose newest seen text is from another thread", async () => {
    const member = await createMember("+14155558205");
    const elsewhere = await saveBroadcast("+14155558299");

    const { body } = await sendAfter(member.id, elsewhere.id).expect(409);

    expect(body.error).toBe(StaffTextConflict.NumberChanged);
  });

  it("refuses over a staff text saved later but dated before the one seen", async () => {
    const member = await createMember("+14155558206");
    const seen = await saveBroadcast("+14155558206");
    const late = await saveBroadcast("+14155558206");
    await mmsRepo().update(late.id, {
      createdAt: new Date(seen.createdAt.getTime() - 3000),
    });

    const { body } = await sendAfter(member.id, seen.id).expect(409);

    expect(body.error).toBe(StaffTextConflict.NewerTexts);
  });

  const sendInThreadAfter = (threadId: string, afterId: number | null) =>
    supertest(server())
      .post(byId(threadId))
      .set("Authorization", admin())
      .send({ body: "The Alliance", afterId });

  it("refuses a text in a number's thread over a newer text, member or not", async () => {
    await inbound({ from: "+14155558217", body: "Who is this?" }).expect(201);
    const seen = await mmsRepo().findOneByOrFail({
      memberPhoneNumber: "+14155558217",
    });
    const threadId = await threadIdFor("+14155558217");
    await inbound({ from: "+14155558217", body: "Hello?" }).expect(201);

    const { body } = await sendInThreadAfter(threadId, seen.id).expect(409);

    expect(body.error).toBe(StaffTextConflict.NewerTexts);
  });

  it("refuses a text in a number's thread naming a text from another thread as a bad request", async () => {
    await inbound({ from: "+14155558218", body: "Hi" }).expect(201);
    const elsewhere = await saveBroadcast("+14155558298");

    await sendInThreadAfter(
      await threadIdFor("+14155558218"),
      elsewhere.id,
    ).expect(400);
  });
});

describe("Live SMS threads socket (e2e)", () => {
  const open: Socket[] = [];

  const connect = (token: string): Socket => {
    const socket = io(`${url}/mms-threads`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    open.push(socket);
    return socket;
  };

  const rejectOnDisconnect = (
    socket: Socket,
    event: string,
    reject: (error: Error) => void,
  ) =>
    socket.once("disconnect", (reason) =>
      reject(new Error(`disconnected (${reason}) awaiting ${event}`)),
    );

  const next = <T>(socket: Socket, event: string): Promise<T> =>
    new Promise((resolve, reject) => {
      socket.once(event, resolve);
      socket.once("connect_error", reject);
      if (event !== "disconnect") rejectOnDisconnect(socket, event, reject);
    });

  const nextMatching = <T>(
    socket: Socket,
    event: string,
    matches: (data: T) => boolean,
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      const listener = (data: T) => {
        if (!matches(data)) return;
        socket.off(event, listener);
        resolve(data);
      };
      socket.on(event, listener);
      rejectOnDisconnect(socket, event, reject);
    });

  const saveAdmin = (name: string) =>
    userRepo().save(
      userRepo().create({
        email: `${randomUUID()}@example.com`,
        password: "pass",
        name,
        referralSource: ReferralSource.None,
        admin: true,
      }),
    );

  let url: string;

  beforeAll(async () => {
    url = await ctx().app.getUrl();
  });

  afterEach(() => {
    for (const socket of open.splice(0)) socket.disconnect();
  });

  it("refuses a member who isn't an admin", async () => {
    await expect(next(connect(ctx().accessToken), "connect")).rejects.toThrow();
  });

  it("disconnects an admin whose admin role is removed", async () => {
    // Its own admin, so later tests' handshakes aren't dropped as predating
    // the revocation.
    const revoked = await saveAdmin("Revoked");
    const socket = connect(signAccessToken(ctx().jwtService, revoked));
    await next(socket, "connect");
    const disconnected = next(socket, "disconnect");

    ctx()
      .app.get(EventEmitter2)
      .emit(UserEvents.AdminRevoked, { userId: revoked.id });

    expect(await disconnected).toBe("io server disconnect");
  });

  it("tells admins when a text arrives on a number", async () => {
    const socket = connect(ctx().adminAccessToken);
    await next(socket, "connect");
    const changed = nextMatching<{ phoneNumber: string }>(
      socket,
      "thread-changed",
      (data) => data.phoneNumber === "+14155558210",
    );

    await inbound({ from: "+14155558210", body: "Hello" }).expect(201);

    expect(await changed).toEqual({
      phoneNumber: "+14155558210",
      needsReplyChanged: true,
    });
  });

  type Changed = { phoneNumber: string; needsReplyChanged: boolean };

  const changesTo = async (
    phoneNumber: string,
    act: () => Promise<unknown>,
  ) => {
    const socket = connect(ctx().adminAccessToken);
    await next(socket, "connect");
    const changed = nextMatching<Changed>(
      socket,
      "thread-changed",
      (data) => data.phoneNumber === phoneNumber,
    );
    await act();
    return changed;
  };

  it("tells admins when staff send a text", async () => {
    const member = await createMember("+14155558211");
    expect(
      await changesTo("+14155558211", () =>
        send(member.id, "Hi from the team").expect(201),
      ),
    ).toEqual({ phoneNumber: "+14155558211", needsReplyChanged: true });
  });

  it("tells admins when a thread is marked handled, and nothing when no text changed", async () => {
    const member = await createMember("+14155558212");
    await inbound({ from: "+14155558212", body: "Hello" }).expect(201);
    const text = await mmsRepo().findOneOrFail({
      where: { memberPhoneNumber: "+14155558212" },
    });
    const markHandled = () =>
      supertest(server())
        .post(`/mms-threads/${member.id}/handled`)
        .set("Authorization", admin())
        .send({ throughId: text.id })
        .expect(204);
    const socket = connect(ctx().adminAccessToken);
    await next(socket, "connect");
    const changes: Changed[] = [];
    socket.on("thread-changed", (data: Changed) => changes.push(data));

    await markHandled();
    await markHandled();
    const after = nextMatching<Changed>(
      socket,
      "thread-changed",
      (data) => data.phoneNumber === "+14155558230",
    );
    await inbound({ from: "+14155558230", body: "Hi" }).expect(201);
    await after;

    expect(changes.filter((c) => c.phoneNumber === "+14155558212")).toEqual([
      { phoneNumber: "+14155558212", needsReplyChanged: true },
    ]);
  });

  it("tells admins when a member opts out or resubscribes", async () => {
    const member = await createMember("+14155558213");
    expect(
      await changesTo("+14155558213", () =>
        supertest(server())
          .post(`/mms-threads/${member.id}/opt-out`)
          .set("Authorization", admin())
          .expect(204),
      ),
    ).toEqual({ phoneNumber: "+14155558213", needsReplyChanged: true });
    expect(
      await changesTo("+14155558213", () =>
        ctx()
          .app.get(MmsUnsubService)
          .subscribeToMms("+14155558213", { rawBody: "START" }),
      ),
    ).toEqual({ phoneNumber: "+14155558213", needsReplyChanged: true });
  });

  it("tells admins when staff reply to or opt out a number no member holds", async () => {
    await inbound({ from: "+14155558216", body: "Who is this?" }).expect(201);
    const threadId = await threadIdFor("+14155558216");
    expect(
      await changesTo("+14155558216", () =>
        sendInThread(threadId, "The Alliance").expect(201),
      ),
    ).toEqual({ phoneNumber: "+14155558216", needsReplyChanged: true });
    expect(
      await changesTo("+14155558216", () =>
        supertest(server())
          .post(byId(threadId, "/opt-out"))
          .set("Authorization", admin())
          .expect(204),
      ),
    ).toEqual({ phoneNumber: "+14155558216", needsReplyChanged: true });
  });

  it("says nothing for a repeated inbound SID", async () => {
    const socket = connect(ctx().adminAccessToken);
    await next(socket, "connect");
    const numbers: string[] = [];
    socket.on("thread-changed", (data: Changed) =>
      numbers.push(data.phoneNumber),
    );
    const sid = randomUUID();
    await inbound({ from: "+14155558214", body: "Hi", sid }).expect(201);
    await inbound({ from: "+14155558214", body: "Hi", sid }).expect(201);
    const after = nextMatching<Changed>(
      socket,
      "thread-changed",
      (data) => data.phoneNumber === "+14155558215",
    );
    await inbound({ from: "+14155558215", body: "Hi" }).expect(201);
    await after;

    expect(numbers.filter((n) => n === "+14155558214")).toHaveLength(1);
  });

  it("shows other admins who is composing until they stop or leave", async () => {
    const other = await saveAdmin("Priya");
    const watcher = connect(ctx().adminAccessToken);
    await next(watcher, "composing");
    const composer = connect(signAccessToken(ctx().jwtService, other));
    await next(composer, "connect");
    type Composers = { adminName: string }[];
    const hasPriya = (list: Composers) =>
      list.some((c) => c.adminName === "Priya");

    const shown = nextMatching(watcher, "composing", hasPriya);
    composer.emit("composing", { phoneNumber: "+14155558242" });
    expect(await shown).toEqual([
      { phoneNumber: "+14155558242", adminId: other.id, adminName: "Priya" },
    ]);

    const stopped = nextMatching<Composers>(
      watcher,
      "composing",
      (l) => !hasPriya(l),
    );
    composer.emit("stopped-composing", { phoneNumber: "+14155558242" });
    await stopped;

    const shownAgain = nextMatching(watcher, "composing", hasPriya);
    composer.emit("composing", { phoneNumber: "+14155558242" });
    await shownAgain;
    const left = nextMatching<Composers>(
      watcher,
      "composing",
      (l) => !hasPriya(l),
    );
    composer.disconnect();
    await left;
  });

  it("logs a composing report it can't read", async () => {
    const warn = jest
      .spyOn(ctx().app.get(MmsThreadGateway)["logger"], "warn")
      .mockImplementation(() => {});
    const client = connect(ctx().adminAccessToken);
    await next(client, "connect");

    client.emit("composing", { phoneNumber: 42 });
    client.emit("stopped-composing", {});
    const handled = nextMatching<{ phoneNumber: string }[]>(
      client,
      "composing",
      (list) => list.some((c) => c.phoneNumber === "+14155558243"),
    );
    client.emit("composing", { phoneNumber: "+14155558243" });
    await handled;

    expect(warn.mock.calls.map(([line]) => String(line))).toEqual([
      expect.stringContaining("malformed composing"),
      expect.stringContaining("malformed stopped-composing"),
    ]);
    warn.mockRestore();
  });
});
