import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppController } from "src/app.controller";
import request from "supertest";

describe("App Controller (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 50000);

  afterAll(async () => {
    await app.close();
  });

  it("exposes a health check endpoint", async () => {
    const res = await request(app.getHttpServer()).get("/").expect(200);
    expect(res.body.status).toBe("OK");
  });
});
