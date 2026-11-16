import { PHONE_NUMBER_INDEX, User } from "src/user/entities/user.entity";
import request from "supertest";
import { EntityManager, QueryFailedError, type Repository } from "typeorm";
import {
  closeTestApp,
  createTestApp,
  signAccessToken,
  type TestContext,
} from "./e2e-test-utils";
import { uniquePhone } from "./otp-fixtures";

const TAKEN =
  "This phone number is already linked to an account. Enter a different number.";

// Stands in for a violation of the index, which this schema lacks.
const takenAtIndex = () =>
  jest.spyOn(EntityManager.prototype, "save").mockRejectedValueOnce(
    Object.assign(new QueryFailedError("UPDATE", [], new Error("duplicate")), {
      code: "23505",
      constraint: PHONE_NUMBER_INDEX,
    }),
  );

describe("One live account per phone number (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let members = 0;

  const createMember = (fields: Partial<User> = {}) =>
    userRepo.save(
      userRepo.create({
        email: `unique-phone-${++members}@example.com`,
        password: "pass",
        name: `Unique Phone ${members}`,
        ...fields,
      }),
    );

  const update = (member: User, body: object) =>
    request(ctx.app.getHttpServer())
      .post("/user/update")
      .set("Authorization", `Bearer ${signAccessToken(ctx.jwtService, member)}`)
      .send(body);

  beforeAll(async () => {
    ctx = await createTestApp([]);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  it("refuses a profile update the index refuses", async () => {
    const phoneNumber = uniquePhone();
    const member = await createMember();
    takenAtIndex();
    const res = await update(member, { phoneNumber }).expect(409);
    expect(res.body.message).toBe(TAKEN);
  });
});
