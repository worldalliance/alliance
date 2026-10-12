import { milliseconds } from "date-fns";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { Post } from "src/forum/entities/post.entity";
import { RecentSearch } from "src/search/recentsearch.entity";
import { SearchModule } from "src/search/search.module";
import { SearchItemType } from "src/search/searchitem.dto";
import { Tag } from "src/user/entities/tag.entity";
import { User } from "src/user/entities/user.entity";
import request from "supertest";
import type { Repository } from "typeorm";
import { createTestApp, signAccessToken, TestContext } from "./e2e-test-utils";

describe("Search (e2e)", () => {
  let ctx: TestContext;
  let userRepo: Repository<User>;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let postRepo: Repository<Post>;
  let recentSearchRepo: Repository<RecentSearch>;

  let targetUser: User;
  let targetAction: Action;
  let targetPost: Post;

  beforeAll(async () => {
    ctx = await createTestApp([SearchModule]);
    userRepo = ctx.dataSource.getRepository(User);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    postRepo = ctx.dataSource.getRepository(Post);
    recentSearchRepo = ctx.dataSource.getRepository(RecentSearch);

    targetUser = await userRepo.save(
      userRepo.create({
        name: "Target User",
        email: "target@example.com",
        password: "Password123!",
        anonymous: false,
      }),
    );

    targetAction = await actionRepo.save(
      actionRepo.create({
        name: "Targeted Cleanup Action",
        category: [],
        body: "Clean the neighbourhood park",
        shortDescription: "Cleanup day",
      }),
    );

    await eventRepo.save(
      eventRepo.create({
        title: "Launch",
        description: "Action is live",
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - milliseconds({ seconds: 1 })),
        action: targetAction,
      }),
    );

    targetPost = await postRepo.save(
      postRepo.create({
        title: "Target Post About Action",
        editableContent: {
          body: "Join us for the cleanup",
          attachments: [],
        },
        author: targetUser,
        authorId: targetUser.id,
        action: targetAction,
        actionId: targetAction.id,
      }),
    );
  }, 50000);

  afterEach(async () => {
    await recentSearchRepo.query("DELETE FROM recent_search");
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("returns matching users, actions, and posts for a search query", async () => {
    const response = await request(ctx.app.getHttpServer())
      .get("/search/all")
      .query({ query: "Target" })
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

    const ids = response.body.map((item) => item.id);
    expect(ids).toContain(`u${targetUser.id}`);
    expect(ids).toContain(`a${targetAction.id}`);
    expect(ids).toContain(`p${targetPost.id}`);
  });

  it("lists only the actions the searching user's feed would list", async () => {
    const draft = await actionRepo.save(
      actionRepo.create({
        name: "Searchgate Draft",
        category: [],
        body: "Hidden",
        shortDescription: "Hidden",
      }),
    );
    const otherTag = await ctx.dataSource
      .getRepository(Tag)
      .save({ name: "Other Tag", description: "Other Tag" });
    const saveLive = async (overrides: Partial<Action>) => {
      const action = await actionRepo.save(
        actionRepo.create({
          category: [],
          body: "Hidden",
          shortDescription: "Hidden",
          ...overrides,
        }),
      );
      await eventRepo.save(
        eventRepo.create({
          title: "Launch",
          description: "Action is live",
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - milliseconds({ seconds: 1 })),
          action,
        }),
      );
      return action;
    };
    const archived = await saveLive({
      name: "Searchgate Archived",
      archived: true,
    });
    const publicOnly = await saveLive({
      name: "Searchgate Public Only",
      publicOnly: true,
    });
    const outsideCohort = await saveLive({
      name: "Searchgate Outside Cohort",
      visibilityMode: VisibilityMode.ParticipatingGroups,
      cohortExpression: { type: "Tag", tagId: otherTag.id },
    });
    const insideCohort = await saveLive({
      name: "Searchgate Inside Cohort",
      visibilityMode: VisibilityMode.ParticipatingGroups,
      cohortExpression: { type: "Tag", tagId: ctx.defaultTag.id },
    });

    const searchIds = async (token: string) =>
      (
        await request(ctx.app.getHttpServer())
          .get("/search/all")
          .query({ query: "Searchgate" })
          .set("Authorization", `Bearer ${token}`)
          .expect(200)
      ).body.map((item) => item.id);

    const memberIds = await searchIds(ctx.accessToken);
    expect(memberIds).toContain(`a${insideCohort.id}`);
    expect(memberIds).not.toContain(`a${draft.id}`);
    expect(memberIds).not.toContain(`a${archived.id}`);
    expect(memberIds).not.toContain(`a${publicOnly.id}`);
    expect(memberIds).not.toContain(`a${outsideCohort.id}`);

    const adminIds = await searchIds(ctx.adminAccessToken);
    expect(adminIds).toContain(`a${draft.id}`);
    expect(adminIds).toContain(`a${archived.id}`);
    expect(adminIds).toContain(`a${outsideCohort.id}`);
    expect(adminIds).not.toContain(`a${publicOnly.id}`);
  });

  it("keeps a scheduled post out of search until it goes live", async () => {
    const scheduledPost = await postRepo.save(
      postRepo.create({
        title: "Target Post Scheduled For Later",
        editableContent: {
          body: "Not live yet",
          attachments: [],
        },
        author: targetUser,
        authorId: targetUser.id,
        visibleAt: new Date(Date.now() + milliseconds({ hours: 1 })),
      }),
    );

    const search = (token?: string) => {
      const req = request(ctx.app.getHttpServer())
        .get("/search/all")
        .query({ query: "Target Post Scheduled" });
      return (token ? req.set("Authorization", `Bearer ${token}`) : req).expect(
        200,
      );
    };

    const authorToken = signAccessToken(ctx.jwtService, targetUser);

    const visitorResponse = await search(ctx.accessToken);
    expect(visitorResponse.body.map((item) => item.id)).not.toContain(
      `p${scheduledPost.id}`,
    );

    const authorResponse = await search(authorToken);
    expect(authorResponse.body.map((item) => item.id)).toContain(
      `p${scheduledPost.id}`,
    );

    const adminResponse = await search(ctx.adminAccessToken);
    expect(adminResponse.body.map((item) => item.id)).toContain(
      `p${scheduledPost.id}`,
    );
  });

  it("persists and returns recent selections when query is empty", async () => {
    await request(ctx.app.getHttpServer())
      .post("/search/selected")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send({
        id: `a${targetAction.id}`,
        name: targetAction.name,
        webAppLocation: "/actions",
        secondaryData: [],
        type: SearchItemType.Action,
      })
      .expect(201);

    const response = await request(ctx.app.getHttpServer())
      .get("/search/all")
      .query({ query: "" })
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].id).toBe(`a${targetAction.id}`);
  });

  it.each([
    {
      label: "a deleted post",
      type: SearchItemType.Post,
      createGone: async () => {
        const post = await postRepo.save(
          postRepo.create({
            title: "Post Deleted After Selection",
            editableContent: { body: "Gone soon", attachments: [] },
            author: targetUser,
            authorId: targetUser.id,
          }),
        );
        await postRepo.delete(post.id);
        return `p${post.id}`;
      },
    },
    {
      label: "a deleted action",
      type: SearchItemType.Action,
      createGone: async () => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Action Deleted After Selection",
            category: [],
            body: "Gone soon",
            shortDescription: "Gone soon",
          }),
        );
        await actionRepo.delete(action.id);
        return `a${action.id}`;
      },
    },
    {
      label: "an action the member can't open",
      type: SearchItemType.Action,
      createGone: async () => {
        const action = await actionRepo.save(
          actionRepo.create({
            name: "Draft Action",
            category: [],
            body: "Not live",
            shortDescription: "Not live",
          }),
        );
        return `a${action.id}`;
      },
    },
  ])("skips $label in recent selections", async ({ type, createGone }) => {
    const save = (id: string, itemType: SearchItemType) =>
      request(ctx.app.getHttpServer())
        .post("/search/selected")
        .set("Authorization", `Bearer ${ctx.accessToken}`)
        .send({
          id,
          name: "Selection",
          webAppLocation: "/",
          secondaryData: [],
          type: itemType,
        })
        .expect(201);

    await save(`a${targetAction.id}`, SearchItemType.Action);
    const goneId = await createGone();
    await save(goneId, type);

    const response = await request(ctx.app.getHttpServer())
      .get("/search/all")
      .query({ query: "" })
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(response.body.map((item) => item.id)).toEqual([
      `a${targetAction.id}`,
    ]);
  });

  it("deduplicates saved selections when the same item is stored again", async () => {
    const payload = {
      id: `u${targetUser.id}`,
      name: targetUser.name,
      webAppLocation: "/users",
      secondaryData: [],
      type: SearchItemType.User,
    };

    await request(ctx.app.getHttpServer())
      .post("/search/selected")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send(payload)
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post("/search/selected")
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .send(payload)
      .expect(201);

    const response = await request(ctx.app.getHttpServer())
      .get("/search/all")
      .query({ query: "" })
      .set("Authorization", `Bearer ${ctx.accessToken}`)
      .expect(200);

    const userItems = response.body.filter(
      (item) => item.id === `u${targetUser.id}`,
    );
    expect(userItems.length).toBe(1);
  });
});
