import type { Repository } from 'typeorm';
import { createTestApp, TestContext } from './e2e-test-utils';
import { ForumActionCompleterWorker } from 'src/actions/forum-action-completer.worker';
import {
  Action,
  ActionTaskType,
  VisibilityMode,
} from 'src/actions/entities/action.entity';
import {
  ActionActivity,
  ActionActivityType,
} from 'src/actions/entities/action-activity.entity';
import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import {
  CustomValidator,
  CustomValidatorType,
} from 'src/tasks/entities/customvalidator.entity';
import { FormSchema } from 'src/tasks/schema';
import { Post } from 'src/forum/entities/post.entity';
import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { User } from 'src/user/entities/user.entity';

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60 * 1000);

describe('ForumActionCompleterWorker (e2e)', () => {
  let ctx: TestContext;
  let worker: ForumActionCompleterWorker;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let activityRepo: Repository<ActionActivity>;
  let formRepo: Repository<Form>;
  let formResponseRepo: Repository<FormResponse>;
  let customValidatorRepo: Repository<CustomValidator>;
  let postRepo: Repository<Post>;
  let commentRepo: Repository<Comment>;
  let editableContentRepo: Repository<EditableContent>;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    worker = ctx.app.get(ForumActionCompleterWorker);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    activityRepo = ctx.dataSource.getRepository(ActionActivity);
    formRepo = ctx.dataSource.getRepository(Form);
    formResponseRepo = ctx.dataSource.getRepository(FormResponse);
    customValidatorRepo = ctx.dataSource.getRepository(CustomValidator);
    postRepo = ctx.dataSource.getRepository(Post);
    commentRepo = ctx.dataSource.getRepository(Comment);
    editableContentRepo = ctx.dataSource.getRepository(EditableContent);
    userRepo = ctx.dataSource.getRepository(User);
  }, 50000);

  afterEach(async () => {
    await activityRepo.query('DELETE FROM action_activity');
    await eventRepo.query('DELETE FROM action_event');
    await actionRepo.query('DELETE FROM action');
    await formResponseRepo.query('DELETE FROM form_response');
    await formRepo.query('DELETE FROM form');
    await customValidatorRepo.query('DELETE FROM custom_validator');
    await commentRepo.query('DELETE FROM comment');
    await postRepo.query('DELETE FROM post');
    await editableContentRepo.query('DELETE FROM editable_content');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const createUser = async (email: string, name: string) => {
    return userRepo.save(
      userRepo.create({
        email,
        password: 'pass',
        name,
        tags: [ctx.defaultTag],
      }),
    );
  };

  const createPost = async (author: User, title: string) => {
    return postRepo.save(
      postRepo.create({
        title,
        author,
        authorId: author.id,
        editableContent: editableContentRepo.create({
          body: 'Post body',
          attachments: [],
        }),
      }),
    );
  };

  const createComment = async (params: {
    author: User;
    post: Post;
    body: string;
    parentId?: number;
  }) => {
    const { author, post, body, parentId } = params;
    return commentRepo.save(
      commentRepo.create({
        author,
        authorId: author.id,
        parentObjectType: CommentParentObject.Post,
        parentObjectId: post.id,
        parentId,
        editableContent: editableContentRepo.create({
          body,
          attachments: [],
        }),
      }),
    );
  };

  const createForumValidator = async (type: CustomValidatorType, postId: number) => {
    return customValidatorRepo.save(
      customValidatorRepo.create({
        type,
        idArgument: postId.toString(),
      }),
    );
  };

  const createFormWithValidator = async (validatorId: number) => {
    const schema: FormSchema = {
      title: 'Forum Action Form',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'reply',
              kind: 'text',
              label: 'Reply',
              visibleIf: [{ validatorId }],
            },
          ],
        },
      ],
      outputViews: [],
    };

    return formRepo.save(
      formRepo.create({
        title: 'Forum Action Form',
        schema: schema as unknown as Record<string, unknown>,
      }),
    );
  };

  const createActionWithEvents = async (params: {
    formId: number;
    now: Date;
  }) => {
    const { formId, now } = params;
    const action = await actionRepo.save(
      actionRepo.create({
        name: 'Forum Action',
        category: 'Forum',
        body: 'Action body',
        shortDescription: 'Short description',
        type: ActionTaskType.Activity,
        commitmentless: true,
        everyoneShouldComplete: true,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        isForumParticipationAction: true,
        taskFormId: formId,
        cohortExpression: { type: 'Tag', tagId: ctx.defaultTag.id },
      }),
    );

    await eventRepo.save([
      eventRepo.create({
        title: 'Member phase',
        description: 'Members take action',
        newStatus: ActionStatus.MemberAction,
        date: addMinutes(now, -30),
        action,
      }),
      eventRepo.create({
        title: 'Resolution phase',
        description: 'Action deadline',
        newStatus: ActionStatus.Resolution,
        date: addMinutes(now, 60),
        action,
      }),
    ]);

    return action;
  };

  it('autocompletes forum responders within the deadline window and runs once', async () => {
    const now = new Date();

    const responder = await createUser('responder@example.com', 'Responder');
    const completedViaForm = await createUser(
      'form-complete@example.com',
      'Form Completer',
    );
    const completedViaActivity = await createUser(
      'activity-complete@example.com',
      'Activity Completer',
    );
    const noReplyUser = await createUser('noreply@example.com', 'No Reply');
    const nonCohortResponder = await userRepo.save(
      userRepo.create({
        email: 'noncohort@example.com',
        password: 'pass',
        name: 'Non Cohort',
        tags: [],
      }),
    );

    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const post = await createPost(postAuthor, 'Forum Thread');

    const validator = await createForumValidator(
      CustomValidatorType.RepliedToForumPost,
      post.id,
    );
    const form = await createFormWithValidator(validator.id);

    const action = await createActionWithEvents({
      formId: form.id,
      now,
    });

    await createComment({ author: responder, post, body: 'Top level reply' });
    await createComment({
      author: completedViaForm,
      post,
      body: 'Reply with form',
    });
    await createComment({
      author: completedViaActivity,
      post,
      body: 'Reply with activity',
    });
    await createComment({
      author: nonCohortResponder,
      post,
      body: 'Reply from non-cohort',
    });

    await formResponseRepo.save(
      formResponseRepo.create({
        formId: form.id,
        form,
        answers: {},
        schemaSnapshot: form.schema as Record<string, unknown>,
        user: completedViaForm,
      }),
    );

    await activityRepo.save(
      activityRepo.create({
        actionId: action.id,
        userId: completedViaActivity.id,
        type: ActionActivityType.USER_COMPLETED,
      }),
    );

    await worker.autocompleteForumActions();

    const completions = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    const completionIds = completions.map((activity) => activity.userId);

    expect(completionIds).toContain(completedViaActivity.id);
    expect(completionIds).toContain(responder.id);
    expect(completionIds).not.toContain(completedViaForm.id);
    expect(completionIds).not.toContain(nonCohortResponder.id);
    expect(completionIds).not.toContain(noReplyUser.id);

    const updatedAction = await actionRepo.findOneOrFail({
      where: { id: action.id },
    });
    expect(updatedAction.computedAutocompleteAt).toBeInstanceOf(Date);

    await createComment({
      author: noReplyUser,
      post,
      body: 'Late reply after computed',
    });

    await worker.autocompleteForumActions();

    const completionsAfterSecondRun = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    expect(completionsAfterSecondRun).toHaveLength(completions.length);
  });

  it('skips actions outside the 1-hour deadline window', async () => {
    const now = new Date();
    const responder = await createUser('window@example.com', 'Window User');

    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const post = await createPost(postAuthor, 'Window Thread');

    const validator = await createForumValidator(
      CustomValidatorType.RepliedToForumPost,
      post.id,
    );
    const form = await createFormWithValidator(validator.id);

    const action = await actionRepo.save(
      actionRepo.create({
        name: 'Forum Action Window',
        category: 'Forum',
        body: 'Action body',
        shortDescription: 'Short description',
        type: ActionTaskType.Activity,
        commitmentless: true,
        everyoneShouldComplete: false,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        isForumParticipationAction: true,
        taskFormId: form.id,
      }),
    );

    await eventRepo.save([
      eventRepo.create({
        title: 'Member phase',
        description: 'Members take action',
        newStatus: ActionStatus.MemberAction,
        date: addMinutes(now, -30),
        action,
      }),
      eventRepo.create({
        title: 'Resolution phase',
        description: 'Deadline far away',
        newStatus: ActionStatus.Resolution,
        date: addMinutes(now, 120),
        action,
      }),
    ]);

    await createComment({
      author: responder,
      post,
      body: 'Reply outside window',
    });

    await worker.autocompleteForumActions();

    const completions = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    expect(completions).toHaveLength(0);

    const updatedAction = await actionRepo.findOneOrFail({
      where: { id: action.id },
    });
    expect(updatedAction.computedAutocompleteAt).toBeNull();
  });

  it('counts child replies when using RepliedToForumPostOrChild', async () => {
    const now = new Date();
    const responder = await createUser('child@example.com', 'Child Responder');

    const postAuthor = await userRepo.findOneOrFail({
      where: { id: ctx.adminUserId },
    });
    const post = await createPost(postAuthor, 'Child Thread');

    const validator = await createForumValidator(
      CustomValidatorType.RepliedToForumPostOrChild,
      post.id,
    );
    const form = await createFormWithValidator(validator.id);

    const action = await createActionWithEvents({
      formId: form.id,
      now,
    });

    const nonCohortCommenter = await userRepo.save(
      userRepo.create({
        email: 'noncohort-child@example.com',
        password: 'pass',
        name: 'Non Cohort Commenter',
        tags: [],
      }),
    );
    const topLevelComment = await createComment({
      author: nonCohortCommenter,
      post,
      body: 'Top level',
    });

    await createComment({
      author: responder,
      post,
      body: 'Child reply',
      parentId: topLevelComment.id,
    });

    await worker.autocompleteForumActions();

    const completions = await activityRepo.find({
      where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
    });
    expect(completions).toHaveLength(1);
    expect(completions[0].userId).toBe(responder.id);
  });
});
