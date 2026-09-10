import { io } from "socket.io-client";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { MessagingModule } from "src/messaging/messaging.module";
import { UserService } from "src/user/user.service";
import { createTestApp, TestContext } from "./e2e-test-utils";

const NAMESPACES = ["/messaging", "/messaging/overview", "/event-log"];

describe("Socket gateway auth (e2e)", () => {
  let ctx: TestContext;
  let url: string;

  /**
   * The messaging gateways refuse in middleware, which reaches the client as
   * connect_error, and the event log gateway refuses by disconnecting a socket
   * that already connected. So acceptance is having connected and still being
   * connected when the window closes, not merely surviving it.
   */
  const connects = (namespace: string, token: string): Promise<boolean> =>
    new Promise((resolve) => {
      let connected = false;
      const socket = io(`${url}${namespace}`, {
        auth: { token },
        transports: ["websocket"],
        reconnection: false,
      });
      const settle = (accepted: boolean) => {
        clearTimeout(held);
        socket.removeAllListeners();
        socket.disconnect();
        resolve(accepted);
      };
      const held = setTimeout(() => settle(connected), 500);
      socket.on("connect", () => {
        connected = true;
      });
      socket.on("connect_error", () => settle(false));
      socket.on("disconnect", () => settle(false));
    });

  beforeAll(async () => {
    ctx = await createTestApp([MessagingModule, EventLogModule]);
    await ctx.app.listen(0);
    url = await ctx.app.getUrl();
  }, 50000);

  afterAll(async () => {
    ctx.app.getHttpServer().closeAllConnections();
    await ctx.app.close();
  });

  it.each(NAMESPACES)("accepts an access token on %s", async (namespace) => {
    expect(await connects(namespace, ctx.adminAccessToken)).toBe(true);
  });

  it.each(NAMESPACES)(
    "refuses a mailed password-reset token on %s",
    async (namespace) => {
      const resetToken = await ctx.app
        .get(UserService)
        .generatePasswordResetToken(ctx.adminUserId);
      expect(await connects(namespace, resetToken)).toBe(false);
    },
  );
});
