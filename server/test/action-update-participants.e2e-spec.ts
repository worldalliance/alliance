import { ActionActivityType } from "@alliance/common/actionActivity";
import { addMinutes } from "date-fns";
import { ActionUpdatesService } from "src/actions/action-updates.service";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import { Action } from "src/actions/entities/action.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import { closeTestApp, createTestApp, TestContext } from "./e2e-test-utils";

describe("Action update participant pictures (e2e)", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterAll(async () => {
    await closeTestApp(ctx.app);
  });

  const createUser = (
    name: string,
    fields: { profilePicture: string | null; anonymous?: boolean },
  ) => {
    const users = ctx.dataSource.getRepository(User);
    return users.save(
      users.create({
        email: `${name}@example.com`,
        password: "pass",
        name,
        referralSource: ReferralSource.None,
        ...fields,
      }),
    );
  };

  const createAction = (name: string) =>
    ctx.dataSource
      .getRepository(Action)
      .save({ name, category: [], body: "Body" });

  it("lists the three latest completers with pictures, leaving out anonymous members", async () => {
    const action = await createAction("Participants");
    const other = await createAction("Other");
    const start = new Date("2026-01-01T00:00:00Z");
    const activities = ctx.dataSource.getRepository(ActionActivity);
    const record = async (params: {
      user: User;
      action: Action;
      minutes: number;
      type?: ActionActivityType;
    }) =>
      activities.save({
        actionId: params.action.id,
        userId: params.user.id,
        type: params.type ?? ActionActivityType.USER_COMPLETED,
        createdAt: addMinutes(start, params.minutes),
      });

    const oldest = await createUser("oldest", { profilePicture: "1.webp" });
    const second = await createUser("second", { profilePicture: "2.webp" });
    const third = await createUser("third", { profilePicture: "3.webp" });
    const newest = await createUser("newest", { profilePicture: "4.webp" });
    const anonymous = await createUser("anon", {
      profilePicture: "5.webp",
      anonymous: true,
    });
    const blank = await createUser("blank", { profilePicture: " " });
    const dismissed = await createUser("dismissed", {
      profilePicture: "6.webp",
    });

    await record({ user: oldest, action, minutes: 1 });
    await record({ user: second, action, minutes: 2 });
    await record({ user: third, action, minutes: 3 });
    await record({ user: newest, action, minutes: 4 });
    await record({ user: anonymous, action, minutes: 5 });
    await record({ user: blank, action, minutes: 6 });
    await record({
      user: dismissed,
      action,
      minutes: 7,
      type: ActionActivityType.USER_DISMISSED,
    });
    await record({ user: oldest, action: other, minutes: 8 });

    const pictures = await ctx.app
      .get(ActionUpdatesService)
      .participantPicturesByAction([action.id, other.id]);

    expect(pictures.get(action.id)).toEqual(["4.webp", "3.webp", "2.webp"]);
    expect(pictures.get(other.id)).toEqual(["1.webp"]);
  });
});
