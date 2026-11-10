import {
  KORA_ACTIVE_NEEDS_TRANSCRIPTS,
  KoraProjectStatus,
} from "@alliance/common/kora";
import { KoraModule } from "src/kora/kora.module";
import request from "supertest";
import { createTestApp, type TestContext } from "./e2e-test-utils";
import { setKoraProjectStatus } from "./kora-fixtures";

describe("Kora project status (e2e)", () => {
  let ctx: TestContext;

  const server = () => request(ctx.app.getHttpServer());
  const setStatus = (status: string, token = ctx.adminAccessToken) =>
    server()
      .put("/kora/admin/project")
      .set("Authorization", `Bearer ${token}`)
      .send({ status });

  beforeAll(async () => {
    ctx = await createTestApp([KoraModule]);
  }, 50000);

  beforeEach(async () => {
    await setKoraProjectStatus(ctx, KoraProjectStatus.Pending);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("shows the status to anyone, signed in or not", async () => {
    const res = await server().get("/kora/project").expect(200);
    expect(res.body).toEqual({ status: KoraProjectStatus.Pending });
  });

  it("lets an admin close the project and reopen it", async () => {
    const closed = await setStatus(KoraProjectStatus.Closed).expect(200);
    expect(closed.body).toMatchObject({
      status: KoraProjectStatus.Closed,
      canActivate: false,
    });
    expect((await server().get("/kora/project").expect(200)).body.status).toBe(
      KoraProjectStatus.Closed,
    );

    await setStatus(KoraProjectStatus.Pending).expect(200);
    expect((await server().get("/kora/project").expect(200)).body.status).toBe(
      KoraProjectStatus.Pending,
    );
  });

  it("refuses Active until transcripts can be uploaded", async () => {
    const res = await setStatus(KoraProjectStatus.Active).expect(400);
    expect(res.body.message).toBe(KORA_ACTIVE_NEEDS_TRANSCRIPTS);
    expect((await server().get("/kora/project").expect(200)).body.status).toBe(
      KoraProjectStatus.Pending,
    );
  });

  it("refuses an unknown status", async () => {
    await setStatus("paused").expect(400);
  });

  it("keeps the status control from non-admins", async () => {
    await setStatus(KoraProjectStatus.Closed, ctx.accessToken).expect(401);
    await server()
      .put("/kora/admin/project")
      .send({ status: "closed" })
      .expect(401);
    await server()
      .get("/kora/admin/project")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(401);
  });
});
