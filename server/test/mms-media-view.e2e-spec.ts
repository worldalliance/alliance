import { setEnv } from "@alliance/common/set-env";
import { MmsModule } from "src/mms/mms.module";
import supertest from "supertest";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { saveInboundMedia } from "./mms-fixtures";

const TEST_ENV = {
  ASSETS_BUCKET: "test-bucket",
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
};

let ctx: TestContext;
let savedEnv: Record<string, string | undefined>;

const server = () => ctx.app.getHttpServer();
const admin = () => `Bearer ${ctx.adminAccessToken}`;

beforeAll(async () => {
  savedEnv = {};
  for (const [name, value] of Object.entries(TEST_ENV)) {
    savedEnv[name] = process.env[name];
    setEnv(name, value);
  }
  ctx = await createTestApp([MmsModule]);
}, 50000);

afterAll(async () => {
  await closeTestApp(ctx.app);
  for (const [name, value] of Object.entries(savedEnv)) setEnv(name, value);
});

describe("Viewing inbound media (e2e)", () => {
  const saveMedia = (params: { s3Key: string | null; contentType: string }) =>
    saveInboundMedia(ctx.dataSource, { from: "+14155558401", ...params });
  const view = (id: number) =>
    supertest(server())
      .get(`/mms-threads/media/${id}`)
      .set("Authorization", admin());
  it("redirects to a short-lived download link for a copied file", async () => {
    const media = await saveMedia({
      s3Key: "mms-media/abc",
      contentType: "video/mp4",
    });

    const res = await view(media.id).expect(302);

    const url = new URL(res.headers.location);
    expect(url.pathname).toBe("/mms-media/abc");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("response-content-disposition")).toBe(
      "attachment",
    );
  });

  it("downloads an SVG, which can run script, instead of showing it", async () => {
    const media = await saveMedia({
      s3Key: "mms-media/svg",
      contentType: "image/svg+xml",
    });

    const res = await view(media.id).expect(302);

    const url = new URL(res.headers.location);
    expect(url.searchParams.get("response-content-disposition")).toBe(
      "attachment",
    );
    expect(url.searchParams.get("response-content-type")).toBe("image/svg+xml");
  });

  it("shows an allowlisted image inline", async () => {
    const media = await saveMedia({
      s3Key: "mms-media/def",
      contentType: "image/png",
    });

    const res = await view(media.id).expect(302);

    const url = new URL(res.headers.location);
    expect(url.searchParams.get("response-content-disposition")).toBe("inline");
    expect(url.searchParams.get("response-content-type")).toBe("image/png");
  });

  it("matches the inline allowlist case-insensitively", async () => {
    const media = await saveMedia({
      s3Key: "mms-media/jkl",
      contentType: "IMAGE/PNG",
    });

    const res = await view(media.id).expect(302);

    const url = new URL(res.headers.location);
    expect(url.searchParams.get("response-content-disposition")).toBe("inline");
  });

  it("serves image/jpg and a type with parameters inline as image/jpeg", async () => {
    for (const contentType of ["image/jpg", "image/jpeg; name=photo.jpg"]) {
      const media = await saveMedia({ s3Key: "mms-media/mno", contentType });

      const res = await view(media.id).expect(302);

      const url = new URL(res.headers.location);
      expect(url.searchParams.get("response-content-disposition")).toBe(
        "inline",
      );
      expect(url.searchParams.get("response-content-type")).toBe("image/jpeg");
    }
  });

  it("refuses non-admins", async () => {
    const media = await saveMedia({
      s3Key: "mms-media/ghi",
      contentType: "image/png",
    });
    await supertest(server())
      .get(`/mms-threads/media/${media.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(401);
  });

  it("is not found until the file is copied", async () => {
    const media = await saveMedia({ s3Key: null, contentType: "video/mp4" });
    await view(media.id).expect(404);
  });

  it("is not found for an unknown id", async () => {
    await view(2_000_000_000).expect(404);
  });
});
