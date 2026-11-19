import type { FormSchema } from "@alliance/common/forms/form-schema";
import { thumbnailKey } from "@alliance/common/image-src";
import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { milliseconds } from "date-fns";
import sharp from "sharp";
import { CreateActionDto } from "src/actions/dto/action.dto";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { MmsService } from "src/mms/mms.service";
import { welcomeMessage } from "src/notifs/textnotifcontents";
import { TasksModule } from "src/tasks/tasks.module";
import { User } from "src/user/entities/user.entity";
import { Readable } from "stream";
import request from "supertest";
import type { Repository } from "typeorm";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";
import { stubSavedSend } from "./opt-in-fixtures";

const UPLOAD_KEY = "1700000000000-upload.webp";

const onboardingSchema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        {
          id: "city",
          type: "input",
          kind: "city",
          label: "Where do you live?",
          autoExtractUserData: true,
        },
        {
          id: "photo",
          type: "input",
          kind: "file",
          label: "Add a photo",
          autoExtractUserData: true,
        },
        {
          id: "bio",
          type: "input",
          kind: "textarea",
          label: "Tell us about yourself",
          autoExtractUserData: true,
        },
        {
          id: "notes",
          type: "input",
          kind: "textarea",
          label: "Anything else?",
        },
      ],
    },
    {
      id: "page-2",
      fields: [
        {
          id: "phone",
          type: "input",
          kind: "phone",
          label: "Phone number",
          autoExtractUserData: true,
        },
        {
          id: "email-notifications",
          type: "input",
          kind: "checkbox",
          label: "Email notifications",
          defaultValue: true,
          autoExtractUserData: { target: "emailNotifications" },
        },
        {
          id: "text-notifications",
          type: "input",
          kind: "checkbox",
          label: "Text notifications",
          defaultValue: true,
          autoExtractUserData: { target: "textNotifications" },
          visibleIfFormula: {
            formula: "phoneGiven",
            conditions: {
              phoneGiven: { kind: "hasValue", when: "phone", hasValue: true },
            },
          },
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

describe("Form answers saved to the member's account (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let s3Send: jest.SpyInstance;
  let png: Buffer;
  let uploadedImage: Buffer;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    userRepo = ctx.dataSource.getRepository(User);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    png = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: "#4d8c1d",
      },
    })
      .png()
      .toBuffer();
  }, 50000);

  beforeEach(async () => {
    uploadedImage = png;
    s3Send = jest
      .spyOn(ctx.app.get<S3Client>("S3_CLIENT"), "send")
      .mockImplementation(async (command: unknown) => {
        if (command instanceof GetObjectCommand) {
          if (command.input.Key !== UPLOAD_KEY) {
            throw new NoSuchKey({ message: "missing", $metadata: {} });
          }
          return { Body: sdkBody(uploadedImage) };
        }
        return {};
      });
    jest.spyOn(ctx.app.get(MmsService), "sendMms").mockResolvedValue(null);
    await userRepo.update(ctx.testUserId, {
      phoneNumber: null,
      profilePicture: null,
      profileDescription: null,
      customCityString: null,
      textByDefault: true,
      emailByDefault: true,
    });
    await ctx.dataSource.query(
      `UPDATE "user" SET "optInMmsId" = NULL WHERE id = $1`,
      [ctx.testUserId],
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    for (const table of [
      "form_response",
      "action_form_assignment",
      "action_form_variant",
      "form",
      "action",
      "action_event",
      "action_activity",
    ]) {
      await ctx.dataSource.query(`DELETE FROM ${table}`);
    }
  });

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const sdkBody = (bytes: Buffer) =>
    Object.assign(Readable.from(bytes), {
      transformToByteArray: async () => new Uint8Array(bytes),
    });

  const submit = async ({
    answers,
    status,
    schema = onboardingSchema,
  }: {
    answers: Record<string, unknown>;
    status: number;
    schema?: FormSchema;
  }) => {
    const action = await actionRepo.save(
      actionRepo.create({
        name: "Set up your account",
        category: [],
        body: "Body copy",
        shortDescription: "Short copy",
        isForumParticipationAction: false,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        optional: false,
        publicOnly: false,
        isContractSigningAction: false,
        onboarding: false,
        cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
      } satisfies CreateActionDto),
    );
    await eventRepo.save(
      eventRepo.create({
        title: "Members taking action",
        description: "",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ seconds: 1 })),
        action,
      }),
    );
    const form = await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Onboarding", schema })
      .expect(201);
    await actionRepo.update(action.id, { taskFormId: form.body.id as number });
    return request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${form.body.id}`)
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        answers,
        formSnapshotId: form.body.formSnapshotId as number,
        actionId: action.id,
        deviceType: "mobile" as const,
      })
      .expect(status);
  };

  const member = () => userRepo.findOneByOrFail({ id: ctx.testUserId });

  const putKeys = () =>
    s3Send.mock.calls
      .map(([command]) => command)
      .filter((command) => command instanceof PutObjectCommand)
      .map((command: PutObjectCommand) => command.input.Key);

  it("saves the location, photo, bio and notification choices", async () => {
    await submit({
      answers: {
        city: "Jackson",
        photo: UPLOAD_KEY,
        bio: "  A firefighter who loves hiking.  ",
        notes: "Not for the profile",
        phone: "+14155551234",
        "email-notifications": false,
        "text-notifications": true,
      },
      status: 201,
    });

    const saved = await member();
    expect(saved.customCityString).toBe("Jackson");
    expect(saved.profileDescription).toBe("A firefighter who loves hiking.");
    expect(saved.emailByDefault).toBe(false);
    expect(saved.textByDefault).toBe(true);
    expect(saved.profilePicture).not.toBeNull();
    expect(saved.profilePicture).not.toBe(UPLOAD_KEY);
    expect(putKeys()).toEqual(
      expect.arrayContaining([
        saved.profilePicture,
        thumbnailKey(saved.profilePicture ?? ""),
      ]),
    );
  });

  it("leaves text notifications alone while the phone number is blank", async () => {
    await submit({
      answers: {
        "email-notifications": true,
        "text-notifications": false,
      },
      status: 201,
    });

    const saved = await member();
    expect(saved.textByDefault).toBe(true);
    expect(saved.emailByDefault).toBe(true);
    expect(saved.profilePicture).toBeNull();
    expect(saved.profileDescription).toBeNull();
  });

  it("sends no opt-in text to a member who turns text notifications off", async () => {
    await submit({
      answers: { phone: "+14155551234", "text-notifications": false },
      status: 201,
    });

    const saved = await member();
    expect(saved.phoneNumber).toBe("+14155551234");
    expect(saved.textByDefault).toBe(false);
    expect(ctx.app.get(MmsService).sendMms).not.toHaveBeenCalled();
  });

  it("texts the opt-in confirmation once the form turns texts on", async () => {
    await userRepo.update(ctx.testUserId, { textByDefault: false });
    const sendMms = stubSavedSend(ctx);

    await submit({
      answers: { phone: "+14155551234", "text-notifications": true },
      status: 201,
    });

    expect(sendMms).toHaveBeenCalledTimes(1);
    expect(sendMms).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+14155551234", body: welcomeMessage }),
    );
    const saved = await userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
      relations: { optInMms: true },
    });
    expect(saved.optInMms).not.toBeNull();
  });

  it("reads the answered one of two checkboxes for the same setting", async () => {
    const branch = (phoneGiven: boolean) => ({
      formula: "phoneGiven",
      conditions: {
        phoneGiven: {
          kind: "hasValue" as const,
          when: "phone",
          hasValue: phoneGiven,
        },
      },
    });
    const schema: FormSchema = {
      pages: [
        {
          id: "page-1",
          fields: [
            {
              id: "phone",
              type: "input",
              kind: "phone",
              label: "Phone number",
            },
            {
              id: "texts-without-phone",
              type: "input",
              kind: "checkbox",
              label: "Text me once I add a number",
              autoExtractUserData: { target: "textNotifications" },
              visibleIfFormula: branch(false),
            },
            {
              id: "texts-with-phone",
              type: "input",
              kind: "checkbox",
              label: "Text notifications",
              autoExtractUserData: { target: "textNotifications" },
              visibleIfFormula: branch(true),
            },
          ],
        },
      ],
      outputViews: [],
    };

    await submit({
      schema,
      answers: { phone: "+14155551234", "texts-with-phone": false },
      status: 201,
    });

    expect((await member()).textByDefault).toBe(false);
  });

  it("refuses a custom component mapped to a notification setting", async () => {
    const schema = {
      pages: [
        {
          id: "page-1",
          fields: [
            {
              id: "share",
              type: "input",
              kind: "custom",
              label: "Share my info publicly",
              componentId: "share-info-publicly",
              autoExtractUserData: { target: "textNotifications" },
            },
          ],
        },
      ],
      outputViews: [],
    };

    await request(ctx.app.getHttpServer())
      .post("/tasks/createForm")
      .set("Authorization", `Bearer ${ctx.adminAccessToken}`)
      .send({ title: "Custom mapping", schema })
      .expect(400);
  });

  it("refuses a photo that was never uploaded before any other change", async () => {
    const response = await submit({
      answers: {
        photo: "1700000000000-missing.webp",
        bio: "Should not be saved",
        phone: "+14155551234",
        "email-notifications": false,
      },
      status: 400,
    });

    expect(response.body.message).toBe("The uploaded photo could not be found");
    expect(ctx.app.get(MmsService).sendMms).not.toHaveBeenCalled();
    const saved = await member();
    expect(saved.profilePicture).toBeNull();
    expect(saved.profileDescription).toBeNull();
    expect(saved.phoneNumber).toBeNull();
    expect(saved.emailByDefault).toBe(true);
  });

  it("saves from the image upload, toggle and time picker fields", async () => {
    const schema: FormSchema = {
      pages: [
        {
          id: "page-1",
          fields: [
            {
              id: "photo",
              type: "input",
              kind: "image",
              label: "Upload photo",
              autoExtractUserData: true,
            },
            {
              id: "email-notifications",
              type: "input",
              kind: "toggle",
              label: "Email notifications",
              required: true,
              autoExtractUserData: { target: "emailNotifications" },
            },
            {
              id: "reminder",
              type: "input",
              kind: "timePicker",
              label: "Reminder time",
              autoExtractUserData: true,
            },
          ],
        },
      ],
      outputViews: [],
    };

    await submit({
      schema,
      answers: { photo: UPLOAD_KEY, "email-notifications": false },
      status: 400,
    });
    await submit({
      schema,
      answers: {
        photo: UPLOAD_KEY,
        "email-notifications": true,
        reminder: "18:30",
      },
      status: 201,
    });

    const saved = await member();
    expect(saved.profilePicture).not.toBeNull();
    expect(saved.emailByDefault).toBe(true);
    expect(saved.preferredReminderTime?.toString()).toBe("18:30:00");
  });

  it("refuses an uploaded file that is not an image", async () => {
    uploadedImage = Buffer.from("not an image");

    await submit({ answers: { photo: UPLOAD_KEY }, status: 400 });

    expect((await member()).profilePicture).toBeNull();
  });
});
