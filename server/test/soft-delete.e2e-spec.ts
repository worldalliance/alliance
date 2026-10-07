import { NotFoundException } from "@nestjs/common";
import { ActionFormVariantService } from "src/actions/action-form-variant.service";
import { ActionsService } from "src/actions/actions.service";
import { ActionFormAssignment } from "src/actions/entities/action-form-assignment.entity";
import { ActionFormVariant } from "src/actions/entities/action-form-variant.entity";
import { Action } from "src/actions/entities/action.entity";
import { Project } from "src/actions/entities/project.entity";
import { ProjectsService } from "src/actions/projects.service";
import {
  softDeleteCascade,
  SoftDeleteRestrictedError,
} from "src/datasources/soft-delete";
import {
  Comment,
  CommentParentObject,
} from "src/forum/entities/comment.entity";
import { Post } from "src/forum/entities/post.entity";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { ReferralSource, User } from "src/user/entities/user.entity";
import {
  createFormWithSnapshot,
  createTestApp,
  TestContext,
  waitForLockWait,
} from "./e2e-test-utils";

const PHYSICALLY_DELETED = [
  "AiDetectionResult",
  "Cluster",
  "RecentSearch",
  "SpentToken",
  "WaitlistBrowser",
  "WaitlistEntryTag",
];

/** Rows no code deletes, which therefore need no deletedAt. */
const NEVER_DELETED = ["EditableContent"];

describe("softDeleteCascade (e2e)", () => {
  let ctx: TestContext;
  let forms = 0;

  const form = async () =>
    (
      await createFormWithSnapshot(ctx.dataSource, {
        title: `Form ${forms++}`,
        schema: { pages: [{ id: "page", fields: [] }], outputViews: [] },
      })
    ).form;

  const variantOf = async (formId: number) => {
    const action = await ctx.dataSource
      .getRepository(Action)
      .save({ name: "Varied", category: [], body: "Test" });
    return ctx.dataSource.getRepository(ActionFormVariant).save({
      actionId: action.id,
      formId,
      name: "Variant",
      splitValue: 1,
    });
  };

  const deletedAt = async (
    target: typeof Form | typeof FormResponse,
    id: number,
  ) =>
    (
      await ctx.dataSource
        .getRepository(target)
        .findOneOrFail({ where: { id }, withDeleted: true })
    ).deletedAt;

  beforeAll(async () => {
    ctx = await createTestApp([]);
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it("covers every entity but the physically and never deleted ones", () => {
    const physical = ctx.dataSource.entityMetadatas
      .filter((metadata) => metadata.tableType !== "junction")
      .filter((metadata) => !metadata.deleteDateColumn)
      .map((metadata) => metadata.name)
      .sort();

    expect(physical).toEqual([...PHYSICALLY_DELETED, ...NEVER_DELETED].sort());
  });

  it("counts only the rows still live once locked", async () => {
    const { id: live } = await form();
    const { id: gone } = await form();
    await ctx.dataSource.getRepository(Form).softDelete(gone);

    expect(
      await softDeleteCascade(ctx.dataSource.manager, {
        target: Form,
        ids: [live, gone],
      }),
    ).toBe(1);
  });

  it("refuses a deletion a live row restricts, applying none of it", async () => {
    const restricted = await form();
    const response = await ctx.dataSource.getRepository(FormResponse).save({
      formId: restricted.id,
      formSnapshotId: restricted.formSnapshotId,
      answers: {},
    });
    await variantOf(restricted.id);

    await expect(
      softDeleteCascade(ctx.dataSource.manager, {
        target: Form,
        ids: [restricted.id],
      }),
    ).rejects.toBeInstanceOf(SoftDeleteRestrictedError);

    expect(await deletedAt(Form, restricted.id)).toBeNull();
    expect(await deletedAt(FormResponse, response.id)).toBeNull();
  });

  it("lets a deleted row's former restriction go", async () => {
    const freed = await form();
    const variant = await variantOf(freed.id);
    const assignment = await ctx.dataSource
      .getRepository(ActionFormAssignment)
      .save({
        actionId: variant.actionId,
        userId: ctx.testUserId,
        variantId: variant.id,
      });
    await expect(
      softDeleteCascade(ctx.dataSource.manager, {
        target: ActionFormVariant,
        ids: [variant.id],
      }),
    ).rejects.toBeInstanceOf(SoftDeleteRestrictedError);

    await softDeleteCascade(ctx.dataSource.manager, {
      target: ActionFormAssignment,
      ids: [assignment.id],
    });
    await softDeleteCascade(ctx.dataSource.manager, {
      target: ActionFormVariant,
      ids: [variant.id],
    });
    await softDeleteCascade(ctx.dataSource.manager, {
      target: Form,
      ids: [freed.id],
    });

    expect(await deletedAt(Form, freed.id)).toEqual(expect.any(Date));
  });

  it("keeps the deletion time of a row deleted before its parent", async () => {
    const userRepo = ctx.dataSource.getRepository(User);
    const author = await userRepo.save(
      userRepo.create({
        name: "Earlier",
        email: "earlier-deletion@example.com",
        password: "password",
      }),
    );
    const postRepo = ctx.dataSource.getRepository(Post);
    const post = await postRepo.save({
      title: "Deleted first",
      authorId: author.id,
      editableContent: { body: "body", attachments: [] },
    });
    const earlier = new Date("2026-01-01T00:00:00Z");
    await postRepo.update(post.id, { deletedAt: earlier });

    await softDeleteCascade(ctx.dataSource.manager, {
      target: User,
      ids: [author.id],
    });

    expect(
      (
        await postRepo.findOneOrFail({
          where: { id: post.id },
          withDeleted: true,
        })
      ).deletedAt,
    ).toEqual(earlier);
  });

  it("refuses to assign an action to a project deleted while it waits", async () => {
    const action = await ctx.dataSource
      .getRepository(Action)
      .save({ name: "Assigned", category: [], body: "Test" });
    const project = await ctx.dataSource
      .getRepository(Project)
      .save({ name: "Closing project" });
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await softDeleteCascade(deletion.manager, {
        target: Project,
        ids: [project.id],
      });
      const assigned = ctx.app
        .get(ProjectsService)
        .assign({ actionId: action.id, projectId: project.id })
        .then(
          () => "assigned",
          (error: unknown) => error,
        );
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect(await assigned).toBeInstanceOf(NotFoundException);
    } finally {
      await deletion.release();
    }
  });

  it("assigns no member to a form variant deleted while it waits", async () => {
    const variant = await variantOf((await form()).id);
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await softDeleteCascade(deletion.manager, {
        target: ActionFormVariant,
        ids: [variant.id],
      });
      const assigned = ctx.app
        .get(ActionFormVariantService)
        .getOrCreateAssignedFormId(variant.actionId, ctx.testUserId);
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect(await assigned).toBeNull();
    } finally {
      await deletion.release();
    }

    expect(
      await ctx.dataSource
        .getRepository(ActionFormAssignment)
        .countBy({ actionId: variant.actionId }),
    ).toBe(0);
  });

  it("keeps an action deleted while an edit of it waits", async () => {
    const action = await ctx.dataSource
      .getRepository(Action)
      .save({ name: "Edited", category: [], body: "Test" });
    const deletion = ctx.dataSource.createQueryRunner();
    await deletion.startTransaction();
    try {
      await softDeleteCascade(deletion.manager, {
        target: Action,
        ids: [action.id],
      });
      const edited = ctx.app
        .get(ActionsService)
        .update(action.id, { name: "Renamed" }, ctx.adminUserId)
        .then(
          () => "edited",
          (error: unknown) => error,
        );
      await waitForLockWait(ctx.dataSource);
      await deletion.commitTransaction();
      expect(await edited).toBeInstanceOf(NotFoundException);
    } finally {
      await deletion.release();
    }

    expect(
      await ctx.dataSource
        .getRepository(Action)
        .findOne({ where: { id: action.id }, withDeleted: true }),
    ).toMatchObject({ name: "Edited", deletedAt: expect.any(Date) });
  });

  describe("cascade rules", () => {
    let emails = 0;
    const member = (overrides: Partial<User> = {}) => {
      const repo = ctx.dataSource.getRepository(User);
      return repo.save(
        repo.create({
          name: "Cascaded",
          email: `soft-delete-cascade-${emails++}@example.com`,
          password: "password",
          ...overrides,
        }),
      );
    };

    it("deletes a row whose restriction the same cascade removes", async () => {
      const variant = await variantOf((await form()).id);
      const assignment = await ctx.dataSource
        .getRepository(ActionFormAssignment)
        .save({
          actionId: variant.actionId,
          userId: ctx.testUserId,
          variantId: variant.id,
        });

      await softDeleteCascade(ctx.dataSource.manager, {
        target: Action,
        ids: [variant.actionId],
      });

      for (const [target, id] of [
        [ActionFormVariant, variant.id],
        [ActionFormAssignment, assignment.id],
      ] as const) {
        expect(
          (
            await ctx.dataSource
              .getRepository(target)
              .findOneOrFail({ where: { id }, withDeleted: true })
          ).deletedAt,
        ).toEqual(expect.any(Date));
      }
    });

    it("detaches SET NULL references of survivors only", async () => {
      const referrer = await member();
      const alongside = await member({
        referredById: referrer.id,
        referralSource: ReferralSource.ReferralLink,
      });
      const survivor = await member({
        referredById: referrer.id,
        referralSource: ReferralSource.ReferralLink,
      });

      await softDeleteCascade(ctx.dataSource.manager, {
        target: User,
        ids: [referrer.id, alongside.id],
      });

      const users = ctx.dataSource.getRepository(User);
      expect(
        await users.findOneOrFail({
          where: { id: alongside.id },
          withDeleted: true,
        }),
      ).toMatchObject({ referredById: referrer.id });
      expect(await users.findOneByOrFail({ id: survivor.id })).toMatchObject({
        referredById: null,
      });
    });

    it("marks live replies under a comment deleted before its author", async () => {
      const author = await member();
      const replier = await member();
      const post = await ctx.dataSource.getRepository(Post).save({
        title: "Thread",
        authorId: replier.id,
        editableContent: { body: "Body", attachments: [] },
      });
      const comments = ctx.dataSource.getRepository(Comment);
      const parent = await comments.save({
        authorId: author.id,
        parentObjectType: CommentParentObject.Post,
        parentObjectId: post.id,
        editableContent: { body: "Parent", attachments: [] },
      });
      const reply = await comments.save({
        authorId: replier.id,
        parentObjectType: CommentParentObject.Post,
        parentObjectId: post.id,
        parentId: parent.id,
        editableContent: { body: "Reply", attachments: [] },
      });
      const earlier = new Date("2026-01-01T00:00:00Z");
      await comments.update(parent.id, { deletedAt: earlier });

      await softDeleteCascade(ctx.dataSource.manager, {
        target: User,
        ids: [author.id],
      });

      const deletedAt = async (id: number) =>
        (await comments.findOneOrFail({ where: { id }, withDeleted: true }))
          .deletedAt;
      expect(await deletedAt(parent.id)).toEqual(earlier);
      expect(await deletedAt(reply.id)).toEqual(expect.any(Date));
    });
  });
});
