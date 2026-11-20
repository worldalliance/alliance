import type { FormSchema } from "@alliance/common/forms/form-schema";
import { setNumberOptedOut } from "src/mms/mms-number.service";
import { MmsService } from "src/mms/mms.service";
import { FormProfileAnswersService } from "src/tasks/form-profile-answers.service";
import { TasksModule } from "src/tasks/tasks.module";
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

const phoneForm: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        {
          id: "phone-number",
          type: "input",
          kind: "phone",
          label: "Phone number",
          autoExtractUserData: true,
        },
        {
          id: "time-zone",
          type: "input",
          kind: "timezone",
          label: "Time zone",
          autoExtractUserData: true,
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

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

  const reload = (member: User) => userRepo.findOneByOrFail({ id: member.id });

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
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

  describe("a form's phone answer", () => {
    const answer = async (member: User, answers: Record<string, string>) =>
      ctx.app.get(FormProfileAnswersService).applyProfileAnswers({
        user: await reload(member),
        schema: phoneForm,
        answers,
      });

    it("skips a number the index refuses, sending no welcome text", async () => {
      const member = await createMember();
      const sendMms = jest.spyOn(ctx.app.get(MmsService), "sendMms");
      takenAtIndex();

      await answer(member, {
        "phone-number": uniquePhone(),
        "time-zone": "America/Chicago",
      });

      expect(await reload(member)).toEqual(
        expect.objectContaining({
          phoneNumber: null,
          timeZone: "America/Chicago",
        }),
      );
      expect(sendMms).not.toHaveBeenCalled();
    });

    it("sends no welcome text to a number that opted out", async () => {
      const member = await createMember();
      const phoneNumber = uniquePhone();
      await setNumberOptedOut(ctx.dataSource.manager, {
        phoneNumber,
        optedOut: true,
      });
      const sendMms = jest.spyOn(ctx.app.get(MmsService), "sendMms");

      await answer(member, { "phone-number": phoneNumber });

      expect((await reload(member)).phoneNumber).toBe(phoneNumber);
      expect(sendMms).not.toHaveBeenCalled();
    });

    it("saves a free number and sends the welcome text to it", async () => {
      const member = await createMember();
      const phoneNumber = uniquePhone();
      const sendMms = jest
        .spyOn(ctx.app.get(MmsService), "sendMms")
        .mockResolvedValue(null);

      await answer(member, { "phone-number": phoneNumber });

      expect((await reload(member)).phoneNumber).toBe(phoneNumber);
      expect(sendMms).toHaveBeenCalledWith(
        expect.objectContaining({ to: phoneNumber }),
      );
    });
  });
});
