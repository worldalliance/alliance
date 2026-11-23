import type { FormSchema } from "@alliance/common/forms/form-schema";
import { setNumberOptedOut } from "src/mms/mms-number.service";
import { MmsService } from "src/mms/mms.service";
import { FormProfileAnswersService } from "src/tasks/form-profile-answers.service";
import { TasksModule } from "src/tasks/tasks.module";
import { PHONE_NUMBER_INDEX, User } from "src/user/entities/user.entity";
import { isUniqueViolation } from "src/utils/db-errors";
import request from "supertest";
import type { Repository } from "typeorm";
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

  it("refuses a second live account with the same number", async () => {
    const phoneNumber = uniquePhone();
    await createMember({ phoneNumber });
    const error: unknown = await createMember({ phoneNumber }).catch(
      (err: unknown) => err,
    );
    expect(isUniqueViolation(error, PHONE_NUMBER_INDEX)).toBe(true);
  });

  it("gives a number only a deleted account holds to a live one", async () => {
    const phoneNumber = uniquePhone();
    const deleted = await createMember({ phoneNumber });
    await userRepo.softDelete(deleted.id);
    const member = await createMember();

    await update(member, { phoneNumber }).expect(201);
    expect((await reload(member)).phoneNumber).toBe(phoneNumber);
  });

  it("refuses a profile update to a number another live account holds", async () => {
    const phoneNumber = uniquePhone();
    await createMember({ phoneNumber });
    const member = await createMember();

    const res = await update(member, { phoneNumber, name: "Renamed" }).expect(
      409,
    );
    expect(res.body.message).toBe(TAKEN);
    expect(await reload(member)).toEqual(
      expect.objectContaining({ phoneNumber: null, name: member.name }),
    );
  });

  describe("a form's phone answer", () => {
    const answer = async (member: User, answers: Record<string, string>) =>
      ctx.app.get(FormProfileAnswersService).applyProfileAnswers({
        user: await reload(member),
        schema: phoneForm,
        answers,
      });

    it("skips a number another live account holds, sending no welcome text", async () => {
      const phoneNumber = uniquePhone();
      await createMember({ phoneNumber });
      const member = await createMember();
      const sendMms = jest.spyOn(ctx.app.get(MmsService), "sendMms");

      await answer(member, {
        "phone-number": phoneNumber,
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
