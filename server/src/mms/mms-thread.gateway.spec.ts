import { EventEmitter2 } from "@nestjs/event-emitter";
import type { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import type { SessionService } from "src/auth/session.service";
import { UserEvents } from "src/user/user.events";
import { MmsThreadGateway } from "./mms-thread.gateway";

// handleConnection reads only data and handshake.issued, and calls emit and
// disconnect; the revoke scan calls only fetchSockets.
const setup = () => {
  const eventEmitter = new EventEmitter2();
  const gateway = new MmsThreadGateway(
    {} as JwtService,
    {} as SessionService,
    eventEmitter,
  );
  gateway.server = Object.assign({} as Server, {
    fetchSockets: async () => [],
  });
  const connect = (issued: number) => {
    const disconnect = jest.fn();
    gateway.handleConnection(
      Object.assign({} as Socket, {
        data: { userId: 3, name: "Sam" },
        handshake: { issued },
        emit: jest.fn(),
        disconnect,
      }),
    );
    return disconnect;
  };
  return { gateway, eventEmitter, connect };
};

it("drops a handshake checked before the admin role was removed", async () => {
  const { gateway, eventEmitter, connect } = setup();
  const issued = Date.now() - 1000;

  eventEmitter.emit(UserEvents.AdminRevoked, { userId: 3 });

  expect(connect(issued)).toHaveBeenCalledWith(true);
  expect(connect(Date.now() + 1000)).not.toHaveBeenCalled();
  await gateway.onModuleDestroy();
});
