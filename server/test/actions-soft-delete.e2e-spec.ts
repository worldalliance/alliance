import { ActionActivityType } from "@alliance/common/actionActivity";
import { NotFoundException } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ActionPartnershipsModule } from "src/action-partnerships/action-partnerships.module";
import { ActionPartnershipsService } from "src/action-partnerships/action-partnerships.service";
import { ActionPartnershipResponse } from "src/action-partnerships/entities/action-partnership-response.entity";
import { ActionFormVariantService } from "src/actions/action-form-variant.service";
import { ActionsService } from "src/actions/actions.service";
import { CreateActionDto } from "src/actions/dto/action.dto";
import { ActionActivity } from "src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "src/actions/entities/action-event.entity";
import { ActionFormAssignment } from "src/actions/entities/action-form-assignment.entity";
import { ActionFormVariant } from "src/actions/entities/action-form-variant.entity";
import { ActionSuite } from "src/actions/entities/action-suite.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
  ActionUpdateNotifyType,
} from "src/actions/entities/action-update.entity";
import { Action, VisibilityMode } from "src/actions/entities/action.entity";
import { FollowUpForm } from "src/actions/entities/follow-up-form.entity";
import { GeneralUpdateActivity } from "src/actions/entities/general-update-activity.entity";
import { GeneralUpdate } from "src/actions/entities/general-update.entity";
import { Project } from "src/actions/entities/project.entity";
import {
  ReminderCohortType,
  ReminderGroup,
  ReminderGroupTimingMode,
} from "src/actions/entities/reminder-group.entity";
import { ProjectsService } from "src/actions/projects.service";
import { AuthService } from "src/auth/auth.service";
import { Guest } from "src/auth/entities/guest.entity";
import { ActionEventReminderService } from "src/notifs/action-event-reminder.service";
import { Form } from "src/tasks/entities/form.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { FormResponseDraft } from "src/tasks/entities/formresponsedraft.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import { TasksModule } from "src/tasks/tasks.module";
import { TasksService } from "src/tasks/tasks.service";
import { Tag } from "src/user/entities/tag.entity";
import { User } from "src/user/entities/user.entity";
import { UserService } from "src/user/user.service";
import type { Repository } from "typeorm";
import {
  createFormWithSnapshot,
  createTestApp,
  type TestContext,
  waitForLockWait,
  writeDuringDeletion,
} from "./e2e-test-utils";

/** Runs `remove` once `load` returns, as a deletion that commits between a
 * writer's read of its parent and its write. */
const deleteAfter =
  <A extends unknown[], R>(
    load: (...args: A) => Promise<R>,
    remove: () => Promise<unknown>,
  ) =>
  async (...args: A): Promise<R> => {
    const loaded = await load(...args);
    await remove();
    return loaded;
  };

describe("Action writers under a deleted parent (e2e)", () => {
  let ctx: TestContext;
  let actions: ActionsService;
  let actionRepo: Repository<Action>;

  const createAction = (name = "Parent action") =>
    actionRepo.save({ name, category: [], body: "Body" });

  const actionDto = (name: string): CreateActionDto => ({
    name,
    category: [],
    body: "Body",
    shortDescription: "Short",
    isForumParticipationAction: false,
    shouldCompleteAfterDeadline: false,
    visibilityMode: VisibilityMode.Public,
    preventCompletion: false,
    optional: false,
    publicOnly: false,
    isContractSigningAction: false,
    onboarding: false,
  });

  const reminderDto = () => ({
    name: "Reminder",
    cohortType: ReminderCohortType.AllUncompleted,
    timingMode: ReminderGroupTimingMode.Absolute,
    sendAtAbsolute: new Date(),
    emailMessage: "Email",
    emailSubject: "Subject",
    textMessage: "Text",
    pushMessage: "Push",
    useSuiteTaskCount: false,
    excludeOptionalActions: false,
    excludePreviouslyNotified: false,
  });

  const form = () =>
    createFormWithSnapshot(ctx.dataSource, {
      title: "Parent form",
      schema: { pages: [], outputViews: [] },
    });

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule, ActionPartnershipsModule]);
    actions = ctx.app.get(ActionsService);
    actionRepo = ctx.dataSource.getRepository(Action);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it("refuses an event for an action deleted after it loads", async () => {
    const action = await createAction();
    const load = actions.findOneOrFail.bind(actions);
    jest
      .spyOn(actions, "findOneOrFail")
      .mockImplementationOnce(
        deleteAfter(load, () => actionRepo.softDelete(action.id)),
      );

    await expect(
      actions.addEvent({
        actionId: action.id,
        userId: ctx.adminUserId,
        event: {
          title: "Launch",
          description: "Launch",
          newStatus: ActionStatus.MemberAction,
          date: new Date(),
        },
        acknowledgeDeadlineShortening: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(ActionEvent).count({
        where: { action: { id: action.id } },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("refuses an update for an action deleted after it loads", async () => {
    const action = await createAction();
    const snapshots = ctx.app.get(FormSnapshotService);
    const load = snapshots.findOrCreate.bind(snapshots);
    jest
      .spyOn(snapshots, "findOrCreate")
      .mockImplementationOnce(
        deleteAfter(load, () => actionRepo.softDelete(action.id)),
      );

    await expect(
      actions.createActionUpdate(action.id, {
        title: "News",
        date: new Date(),
        notifyType: ActionUpdateNotifyType.None,
        notificationMode: ActionUpdateNotificationMode.Normal,
        shortNotifString: "",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(ActionUpdate).count({
        where: { action: { id: action.id } },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("refuses a form response for a form deleted after it loads", async () => {
    const { form: parent, snapshot } = await form();
    const tasks = ctx.app.get(TasksService);
    const load = tasks.getForm.bind(tasks);
    jest
      .spyOn(tasks, "getForm")
      .mockImplementationOnce(
        deleteAfter(load, () =>
          ctx.dataSource.getRepository(Form).softDelete(parent.id),
        ),
      );

    await expect(
      tasks.submitFormPublic({
        formId: parent.id,
        submitFormDto: {
          answers: {},
          actionId: 0,
          deviceType: "desktop",
          formSnapshotId: snapshot.id,
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(FormResponse).count({
        where: { formId: parent.id },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("refuses a reminder group for an event deleted after it loads", async () => {
    const action = await createAction();
    const events = ctx.dataSource.getRepository(ActionEvent);
    const event = await events.save({
      title: "Launch",
      description: "Launch",
      newStatus: ActionStatus.MemberAction,
      date: new Date(),
      action,
    });
    const reminders = ctx.app.get(ActionEventReminderService);
    const load = reminders.resolveTimingAnchorEvent.bind(reminders);
    jest
      .spyOn(reminders, "resolveTimingAnchorEvent")
      .mockImplementationOnce(
        deleteAfter(load, () => events.softDelete(event.id)),
      );

    await expect(
      reminders.createReminderGroup(event.id, reminderDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(ReminderGroup).count({
        where: { memberActionEvent: { id: event.id } },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("refuses an activity for an action deleted after it loads", async () => {
    const action = await createAction();
    const load = actions.findOneOrFail.bind(actions);
    jest
      .spyOn(actions, "findOneOrFail")
      .mockImplementationOnce(
        deleteAfter(load, () => actionRepo.softDelete(action.id)),
      );

    await expect(
      actions.createActionActivity({
        actionId: action.id,
        userId: ctx.adminUserId,
        type: ActionActivityType.USER_DISMISSED,
        adminCreated: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(ActionActivity).count({
        where: { actionId: action.id },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("refuses an activity for a form response deleted before it lands", async () => {
    const action = await createAction();
    const { form: parent, snapshot } = await form();
    const responses = ctx.dataSource.getRepository(FormResponse);
    const response = await responses.save({
      formId: parent.id,
      formSnapshotId: snapshot.id,
      user: { id: ctx.adminUserId },
      answers: {},
    });
    await responses.softDelete(response.id);

    await expect(
      actions.createActionActivity({
        actionId: action.id,
        userId: ctx.adminUserId,
        type: ActionActivityType.USER_COMPLETED,
        taskFormResponse: response,
        adminCreated: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(ActionActivity).count({
        where: { actionId: action.id },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("saves an edit to an action whose unchanged task form is gone", async () => {
    const { form: taskForm } = await form();
    const action = await actionRepo.save({
      name: "Form action",
      category: [],
      body: "Body",
      taskFormId: taskForm.id,
    });
    await ctx.app.get(TasksService).deleteForm(taskForm.id);

    await actions.update(
      action.id,
      { name: "Renamed", taskFormId: taskForm.id },
      ctx.adminUserId,
    );
    expect(await actionRepo.findOneByOrFail({ id: action.id })).toMatchObject({
      name: "Renamed",
    });
  });

  it("refuses to attach an action to a deleted suite", async () => {
    const action = await createAction();
    const suites = ctx.dataSource.getRepository(ActionSuite);
    const suite = await suites.save(suites.create({ name: "Deleted suite" }));
    await suites.softDelete(suite.id);

    await expect(
      actions.update(action.id, { suiteId: suite.id }, ctx.adminUserId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await actionRepo.findOneOrFail({
        where: { id: action.id },
        relations: { suite: true },
      }),
    ).toMatchObject({ suite: null });
  });

  it("creates no follow-up form for a form deleted after it loads", async () => {
    const action = await createAction();
    const { form: parent } = await form();
    const forms = ctx.app.get<Repository<Form>>(getRepositoryToken(Form));
    const load = forms.findOneOrFail.bind(forms);
    jest
      .spyOn(forms, "findOneOrFail")
      .mockImplementationOnce(
        deleteAfter(load, () => forms.softDelete(parent.id)),
      );

    await expect(
      actions.createFollowUpForm(action.id, {
        actionId: action.id,
        formId: parent.id,
        name: "Follow-up",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource
        .getRepository(FollowUpForm)
        .count({ where: { actionId: action.id }, withDeleted: true }),
    ).toBe(0);
  });

  it("creates no general update with a tag deleted after it loads", async () => {
    const tags = ctx.app.get<Repository<Tag>>(getRepositoryToken(Tag));
    const tag = await tags.save({
      name: "Gone general tag",
      description: "Tag",
    });
    const load = tags.findBy.bind(tags);
    jest
      .spyOn(tags, "findBy")
      .mockImplementationOnce(deleteAfter(load, () => tags.softDelete(tag.id)));

    await expect(
      actions.createGeneralUpdate({
        name: "Tagged update",
        startDate: new Date(),
        endDate: new Date(Date.now() + 86_400_000),
        useManualCohort: false,
        manualCohortUserIds: [],
        tagIds: [tag.id],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource
        .getRepository(GeneralUpdate)
        .count({ where: { name: "Tagged update" }, withDeleted: true }),
    ).toBe(0);
  });

  describe("form variants", () => {
    let variants: ActionFormVariantService;
    let variantRepo: Repository<ActionFormVariant>;
    let assignments: Repository<ActionFormAssignment>;

    beforeAll(() => {
      variants = ctx.app.get(ActionFormVariantService);
      variantRepo = ctx.dataSource.getRepository(ActionFormVariant);
      assignments = ctx.dataSource.getRepository(ActionFormAssignment);
    });

    const variantOfDeletedAction = async () => {
      const action = await createAction();
      const { form: parent } = await form();
      const variant = await variantRepo.save(
        variantRepo.create({
          actionId: action.id,
          formId: parent.id,
          name: "Only variant",
          splitValue: 1,
        }),
      );
      await actionRepo.softDelete(action.id);
      return { action, variant };
    };

    it("assigns no variant of a deleted action", async () => {
      const { action } = await variantOfDeletedAction();

      expect(
        await variants.getOrCreateAssignedFormId(action.id, ctx.testUserId),
      ).toBeNull();
      expect(
        await variants.getOrCreateAssignedFormIdsForActions(
          [action.id],
          ctx.testUserId,
        ),
      ).toEqual(new Map());
      expect(
        await assignments.count({
          where: { actionId: action.id },
          withDeleted: true,
        }),
      ).toBe(0);
    });

    it("refuses to edit a variant of a deleted action", async () => {
      const { variant } = await variantOfDeletedAction();

      await expect(
        variants.updateVariant(variant.id, { name: "Renamed" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("projects", () => {
    let projects: ProjectsService;
    let projectRepo: Repository<Project>;

    beforeAll(() => {
      projects = ctx.app.get(ProjectsService);
      projectRepo = ctx.dataSource.getRepository(Project);
    });

    it("refuses to assign an action to a deleted project", async () => {
      const action = await createAction();
      const project = await projectRepo.save({ name: "Deleted project" });
      await projectRepo.softDelete(project.id);

      await expect(
        projects.assign({ actionId: action.id, projectId: project.id }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("waits for a project being deleted before assigning to it", async () => {
      const action = await createAction();
      const project = await projectRepo.save({ name: "Doomed project" });

      expect(
        await writeDuringDeletion({
          dataSource: ctx.dataSource,
          target: Project,
          id: project.id,
          write: () =>
            projects.assign({ actionId: action.id, projectId: project.id }),
        }),
      ).toBeInstanceOf(NotFoundException);
    });

    it("waits for an action being deleted before assigning it", async () => {
      const action = await createAction();
      const project = await projectRepo.save({ name: "Live project" });

      expect(
        await writeDuringDeletion({
          dataSource: ctx.dataSource,
          target: Action,
          id: action.id,
          write: () =>
            projects.assign({ actionId: action.id, projectId: project.id }),
        }),
      ).toBeInstanceOf(NotFoundException);
    });
  });

  it("waits for a partnership response being deleted before noting it", async () => {
    const responses = ctx.dataSource.getRepository(ActionPartnershipResponse);
    const response = await responses.save(
      responses.create({
        organizationName: "Org",
        personName: "Person",
        contact: "contact@example.com",
        outreachChannels: [],
        audienceSize: "10",
        desiredCollaboration: "Help",
      }),
    );

    expect(
      await writeDuringDeletion({
        dataSource: ctx.dataSource,
        target: ActionPartnershipResponse,
        id: response.id,
        write: () =>
          ctx.app
            .get(ActionPartnershipsService)
            .createNoteAdmin(response.id, { body: "Note" }),
      }),
    ).toBeInstanceOf(NotFoundException);
  });

  describe("reminder group edits", () => {
    let reminders: ActionEventReminderService;
    let groups: Repository<ReminderGroup>;

    const liveGroup = async () => {
      const action = await createAction();
      const event = await ctx.dataSource.getRepository(ActionEvent).save({
        title: "Launch",
        description: "Launch",
        newStatus: ActionStatus.MemberAction,
        date: new Date(),
        action,
      });
      return reminders.createReminderGroup(event.id, reminderDto());
    };

    beforeAll(() => {
      reminders = ctx.app.get(ActionEventReminderService);
      groups = ctx.dataSource.getRepository(ReminderGroup);
    });

    it("refuses to point a reminder group at a tag deleted after it loads", async () => {
      const group = await liveGroup();
      const tags = ctx.dataSource.getRepository(Tag);
      const tag = await tags.save({ name: "Doomed tag", description: "Tag" });
      const users = ctx.app.get(UserService);
      const load = users.findTagOrFail.bind(users);
      jest
        .spyOn(users, "findTagOrFail")
        .mockImplementationOnce(
          deleteAfter(load, () => tags.softDelete(tag.id)),
        );

      await expect(
        reminders.updateReminderGroup(group.id, {
          ...reminderDto(),
          cohortType: ReminderCohortType.Tag,
          userTagId: tag.id,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        await groups.findOneOrFail({
          where: { id: group.id },
          loadRelationIds: { relations: ["userTag"] },
        }),
      ).toMatchObject({ userTag: null });
    });
  });

  it("creates no action in a suite deleted after it loads", async () => {
    const suites = ctx.dataSource.getRepository(ActionSuite);
    const suite = await suites.save(suites.create({ name: "Doomed suite" }));
    const repo = ctx.app.get<Repository<ActionSuite>>(
      getRepositoryToken(ActionSuite),
    );
    const load = repo.findOneOrFail.bind(repo);
    jest
      .spyOn(repo, "findOneOrFail")
      .mockImplementationOnce(
        deleteAfter(load, () => suites.softDelete(suite.id)),
      );

    await expect(
      actions.create({ ...actionDto("Suite orphan"), suiteId: suite.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await actionRepo.count({
        where: { name: "Suite orphan" },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("creates no action by an author deleted after it loads", async () => {
    const users = ctx.dataSource.getRepository(User);
    const author = await users.save(
      users.create({
        name: "Doomed author",
        email: "doomed-author@example.com",
        password: "password",
      }),
    );
    const userService = ctx.app.get(UserService);
    const load = userService.findByIds.bind(userService);
    jest
      .spyOn(userService, "findByIds")
      .mockImplementationOnce(
        deleteAfter(load, () => users.softDelete(author.id)),
      );

    await expect(
      actions.create({ ...actionDto("Author orphan"), authorIds: [author.id] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await actionRepo.count({
        where: { name: "Author orphan" },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("creates no action on a deleted task form", async () => {
    const { form: taskForm } = await form();
    await ctx.dataSource.getRepository(Form).softDelete(taskForm.id);

    await expect(
      actions.create({ ...actionDto("Form orphan"), taskFormId: taskForm.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await actionRepo.count({
        where: { name: "Form orphan" },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("refuses to point an update at a deleted tag", async () => {
    const action = await createAction();
    const update = await actions.createActionUpdate(action.id, {
      title: "News",
      date: new Date(),
      notifyType: ActionUpdateNotifyType.None,
      notificationMode: ActionUpdateNotificationMode.Normal,
      shortNotifString: "",
    });
    const tags = ctx.dataSource.getRepository(Tag);
    const tag = await tags.save({
      name: "Gone update tag",
      description: "Tag",
    });
    await tags.softDelete(tag.id);

    await expect(
      actions.updateActionUpdate(update.id, { tagId: tag.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(ActionUpdate).findOneOrFail({
        where: { id: update.id },
        loadRelationIds: { relations: ["tag"] },
      }),
    ).toMatchObject({ tag: null });
  });

  it("waits on the action before locking an update's event, as deleting the action does", async () => {
    const action = await createAction();
    const event = await ctx.dataSource.getRepository(ActionEvent).save({
      title: "Launch",
      description: "Launch",
      newStatus: ActionStatus.MemberAction,
      date: new Date(),
      action,
    });
    const update = await actions.createActionUpdate(action.id, {
      title: "News",
      date: new Date(),
      notifyType: ActionUpdateNotifyType.None,
      notificationMode: ActionUpdateNotificationMode.Normal,
      shortNotifString: "",
    });
    const runner = ctx.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query(`SELECT 1 FROM action WHERE id = $1 FOR UPDATE`, [
        action.id,
      ]);
      const saved = actions.updateActionUpdate(update.id, {
        associatedEventId: event.id,
      });
      await waitForLockWait(ctx.dataSource);
      await runner.query(
        `SELECT 1 FROM action_event WHERE id = $1 FOR UPDATE NOWAIT`,
        [event.id],
      );
      await runner.query(
        `SELECT 1 FROM action_update WHERE id = $1 FOR UPDATE NOWAIT`,
        [update.id],
      );
      await runner.query(`DELETE FROM action WHERE id = $1`, [action.id]);
      await runner.commitTransaction();
      await expect(saved).rejects.toBeInstanceOf(NotFoundException);
    } finally {
      await runner.release();
    }
  });

  it("records no dismissal by a member deleted after the update loads", async () => {
    const users = ctx.dataSource.getRepository(User);
    const member = await users.save(
      users.create({
        name: "Dismissing member",
        email: "dismissing-member@example.com",
        password: "password",
      }),
    );
    const generalUpdate = await actions.createGeneralUpdate({
      name: "Dismissed update",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86_400_000),
      useManualCohort: false,
      manualCohortUserIds: [],
    });
    await users.softDelete(member.id);
    jest
      .spyOn(actions, "findUnreadGeneralUpdates")
      .mockResolvedValueOnce([generalUpdate]);

    await expect(
      actions.dismissGeneralUpdate(member.id, generalUpdate.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(GeneralUpdateActivity).count({
        where: { user: { id: member.id } },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  it("records no dismissal of a general update deleted after it loads", async () => {
    const generalUpdate = await actions.createGeneralUpdate({
      name: "Doomed update",
      startDate: new Date(),
      endDate: new Date(Date.now() + 86_400_000),
      useManualCohort: false,
      manualCohortUserIds: [],
    });
    await ctx.dataSource
      .getRepository(GeneralUpdate)
      .softDelete(generalUpdate.id);
    jest
      .spyOn(actions, "findUnreadGeneralUpdates")
      .mockResolvedValueOnce([generalUpdate]);

    await expect(
      actions.dismissGeneralUpdate(ctx.testUserId, generalUpdate.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      await ctx.dataSource.getRepository(GeneralUpdateActivity).count({
        where: { generalUpdate: { id: generalUpdate.id } },
        withDeleted: true,
      }),
    ).toBe(0);
  });

  describe("form drafts and responses", () => {
    let tasks: TasksService;

    const taskForm = async () => {
      const { form: parent, snapshot } = await form();
      const action = await createAction();
      await actionRepo.update(action.id, { taskFormId: parent.id });
      return { action, form: parent, snapshot };
    };

    /** Runs `remove` after the submitted-response check every save makes. */
    const deleteAfterSubmittedCheck = (remove: () => Promise<unknown>) => {
      const repo = ctx.app.get<Repository<FormResponse>>(
        getRepositoryToken(FormResponse),
      );
      const load = repo.findOne.bind(repo);
      jest
        .spyOn(repo, "findOne")
        .mockImplementationOnce(deleteAfter(load, remove));
    };

    beforeAll(() => {
      tasks = ctx.app.get(TasksService);
    });

    it.each([
      ["action", "Action not found"],
      ["form", "Form not found"],
      ["user", "User not found"],
    ] as const)(
      "saves no draft once its %s is deleted",
      async (parent, message) => {
        const { action, form: draftForm, snapshot } = await taskForm();
        const users = ctx.dataSource.getRepository(User);
        const user = await users.save(
          users.create({
            name: "Drafting member",
            email: `drafting-${parent}@example.com`,
            password: "password",
          }),
        );
        deleteAfterSubmittedCheck(() => {
          switch (parent) {
            case "action":
              return actionRepo.softDelete(action.id);
            case "form":
              return ctx.dataSource
                .getRepository(Form)
                .softDelete(draftForm.id);
            case "user":
              return users.softDelete(user.id);
            default:
              throw new Error(`unknown parent: ${parent satisfies never}`);
          }
        });

        await expect(
          tasks.saveFormDraft({
            userId: user.id,
            formId: draftForm.id,
            dto: {
              actionId: action.id,
              formSnapshotId: snapshot.id,
              answers: {},
            },
          }),
        ).rejects.toEqual(new NotFoundException(message));
        expect(
          await ctx.dataSource.getRepository(FormResponseDraft).count({
            where: { formId: draftForm.id },
            withDeleted: true,
          }),
        ).toBe(0);
      },
    );

    it("saves no response once its guest is deleted", async () => {
      const { form: parent, snapshot } = await form();
      const { guestId } = await ctx.app.get(AuthService).createGuestSession();
      deleteAfterSubmittedCheck(() =>
        ctx.dataSource.getRepository(Guest).softDelete(guestId),
      );

      await expect(
        tasks.submitFormPublic({
          formId: parent.id,
          guestId,
          submitFormDto: {
            answers: {},
            actionId: 0,
            deviceType: "desktop",
            formSnapshotId: snapshot.id,
          },
        }),
      ).rejects.toEqual(new NotFoundException("Guest not found"));
      expect(
        await ctx.dataSource.getRepository(FormResponse).count({
          where: { formId: parent.id },
          withDeleted: true,
        }),
      ).toBe(0);
    });
  });
});
