import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { describe, expect, it } from "bun:test";
import { connect } from "node:net";
import { closeTestApp } from "./e2e-test-utils";

@Module({})
class EmptyModule {}

describe("closeTestApp", () => {
  it("closes while a request is still in flight", async () => {
    const app = await NestFactory.create(EmptyModule, { logger: false });
    const arrived = Promise.withResolvers<void>();
    app.use("/slow", () => arrived.resolve());
    await app.listen(0, "127.0.0.1");
    const { port } = app.getHttpServer().address();
    const socket = connect(port, "127.0.0.1");
    await new Promise((resolve) => socket.once("connect", resolve));
    socket.write("GET /slow HTTP/1.1\r\nHost: localhost\r\n\r\n");
    await arrived.promise;

    const outcome = await Promise.race([
      closeTestApp(app).then(() => "closed"),
      Bun.sleep(2000).then(() => "hung"),
    ]);
    socket.destroy();

    expect(outcome).toBe("closed");
  });
});
