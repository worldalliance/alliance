import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { afterEach, expect, it, mock } from "bun:test";
import { AuthOptionalGuard } from "src/auth/guards/authoptional.guard";
import request from "supertest";
import { DocsController } from "./hosted-docs.controller";
import { HostedDocsService } from "./hosted-docs.service";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

it("answers 503 without the team's secrets, uncached and uncounted", async () => {
  process.env = {
    ...original,
    NODE_ENV: "development",
    ALLIANCE_WITHOUT_TEAM_SECRETS: "1",
  };
  const countView = mock(() => {});
  const module = await Test.createTestingModule({
    controllers: [DocsController],
    providers: [
      {
        provide: HostedDocsService,
        useValue: {
          findBySlug: async () => ({ id: 1, slug: "doc", s3Key: "k.pdf" }),
          countView,
        },
      },
      { provide: "S3_CLIENT", useValue: {} },
    ],
  })
    .overrideGuard(AuthOptionalGuard)
    .useValue({ canActivate: () => true })
    .compile();
  const app = module.createNestApplication<NestExpressApplication>();
  await app.init();

  const response = await request(app.getHttpServer()).get("/docs/doc");
  await app.close();

  expect(response.status).toBe(503);
  expect(response.headers.etag).not.toBe(`"k"`);
  expect(response.headers["cache-control"]).toBeUndefined();
  expect(countView).not.toHaveBeenCalled();
});
