import { ActionActivityType } from '@alliance/common/actionActivity';
import type {
  FormSchema,
  RankingField,
} from '@alliance/common/forms/form-schema';
import type { Condition } from '@alliance/common/forms/visible-if-formula';
import { CreateActionDto } from 'src/actions/dto/action.dto';
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import {
  Action,
  ActionTaskType,
  VisibilityMode,
} from 'src/actions/entities/action.entity';
import { Community } from 'src/community/entities/community.entity';
import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { Post } from 'src/forum/entities/post.entity';
import { CustomValidatorTypeDto } from 'src/tasks/customvalidator.dto';
import {
  CustomValidator,
  CustomValidatorType,
  typeUsableForVisibility,
  typeUsesIdArgument,
} from 'src/tasks/entities/customvalidator.entity';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import { TasksModule } from 'src/tasks/tasks.module';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import { User } from 'src/user/entities/user.entity';
import request from 'supertest';
import type { Repository } from 'typeorm';
import { createTestApp, TestContext } from './e2e-test-utils';

const sampleSchema: FormSchema = {
  pages: [
    {
      id: 'page-1',
      fields: [
        {
          id: 'hero-image',
          type: 'display',
          kind: 'image',
          alt: 'Hero Image',
          src: 'local-image-key',
        },
        {
          id: 'full-name',
          type: 'input',
          kind: 'text',
          label: 'Full name',
          required: true,
        },
        {
          id: 'phone-number',
          type: 'input',
          kind: 'phone',
          label: 'Phone Number',
          autoExtractUserData: true,
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [
    {
      kind: 'progressbar',
      id: 'aggregate-1',
      title: 'Static aggregate',
      caption: 'Progress',
      numerator: { type: 'number', value: 10 },
      denominator: { type: 'number', value: 100 },
      displayType: 'number',
    },
  ],
};

describe('Tasks (e2e)', () => {
  let ctx: TestContext;
  let formRepo: Repository<Form>;
  let formResponseRepo: Repository<FormResponse>;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let userRepo: Repository<User>;
  let actionActivityRepo: Repository<ActionActivity>;
  let customValidatorRepo: Repository<CustomValidator>;
  let contractEventRepo: Repository<ContractEvent>;
  let communityRepo: Repository<Community>;
  let postRepo: Repository<Post>;
  let commentRepo: Repository<Comment>;
  let editableContentRepo: Repository<EditableContent>;
  let formId: number;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    formRepo = ctx.dataSource.getRepository(Form);
    formResponseRepo = ctx.dataSource.getRepository(FormResponse);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    userRepo = ctx.dataSource.getRepository(User);
    actionActivityRepo = ctx.dataSource.getRepository(ActionActivity);
    customValidatorRepo = ctx.dataSource.getRepository(CustomValidator);
    contractEventRepo = ctx.dataSource.getRepository(ContractEvent);
    communityRepo = ctx.dataSource.getRepository(Community);
    postRepo = ctx.dataSource.getRepository(Post);
    commentRepo = ctx.dataSource.getRepository(Comment);
    editableContentRepo = ctx.dataSource.getRepository(EditableContent);
  }, 50000);

  afterEach(async () => {
    await formResponseRepo.query('DELETE FROM form_response');
    await formRepo.query('DELETE FROM form');
    await actionRepo.query('DELETE FROM action');
    await eventRepo.query('DELETE FROM action_event');
    await actionActivityRepo.query('DELETE FROM action_activity');
    await commentRepo.query('DELETE FROM comment');
    await postRepo.query('DELETE FROM post');
    await editableContentRepo.query('DELETE FROM editable_content');
    await contractEventRepo.query('DELETE FROM contract_event');
    await communityRepo.query('DELETE FROM community');
    await customValidatorRepo.query('DELETE FROM custom_validator');
    await userRepo.update(ctx.testUserId, {
      phoneNumber: null,
      profilePicture: null,
      profileDescription: null,
      timeZone: null as unknown as string,
      customCityString: null,
      shareInfoPublicly: false,
      preferredReminderTime: null,
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  /** A live (non-draft) member action; link a form via actionRepo.update(id, { taskFormId }). */
  const createAction = async (name: string): Promise<Action> => {
    const action = await actionRepo.save(
      actionRepo.create({
        name,
        category: 'Community',
        body: 'Body copy',
        shortDescription: 'Short copy',
        type: ActionTaskType.Activity,
        isForumParticipationAction: false,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        optional: false,
        publicOnly: false,
        isContractSigningAction: false,
        onboarding: false,
        followUpForms: [],
        cohortExpression: {
          type: 'Tag',
          tagId: ctx.defaultTag.id,
        },
      } satisfies CreateActionDto),
    );

    await eventRepo.save(
      eventRepo.create({
        title: `${name} Event`,
        description: `${name} Event`,
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        action,
      }),
    );

    return action;
  };

  it('supports the full admin and member lifecycle for forms', async () => {
    const createResponse = await request(ctx.app.getHttpServer())
      .post('/tasks/createForm')
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: 'Volunteer Signup',
        schema: sampleSchema,
      })
      .expect(201);

    formId = createResponse.body.id;
    expect(createResponse.body.title).toBe('Volunteer Signup');

    const testAction = await actionRepo.save(
      actionRepo.create({
        name: 'Form Linked Action',
        category: 'Community',
        body: 'Body copy',
        shortDescription: 'Short copy',
        taskFormId: formId,
        type: ActionTaskType.Activity,
        isForumParticipationAction: false,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        optional: false,
        publicOnly: false,
        onboarding: false,
        isContractSigningAction: false,
        cohortExpression: {
          type: 'Tag',
          tagId: ctx.defaultTag.id,
        },
        followUpForms: [],
      } satisfies CreateActionDto),
    );

    await eventRepo.save(
      eventRepo.create({
        title: 'Form Linked Action',
        description: 'Make non-draft',
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        action: testAction,
      }),
    );

    const getResponse = await request(ctx.app.getHttpServer())
      .get(`/tasks/slug/${formId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    const imageField = getResponse.body.schema.pages[0].fields.find(
      (field) => field.id === 'hero-image',
    );
    expect(imageField).toBeDefined();
    expect(imageField.src).toBe('http://localhost:3005/images/local-image-key');

    const updateResponse = await request(ctx.app.getHttpServer())
      .put(`/tasks/updateForm/${formId}`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: 'Updated Volunteer Signup',
        schema: sampleSchema,
      })
      .expect(200);

    expect(updateResponse.body.title).toBe('Updated Volunteer Signup');

    const submitDto = {
      answers: {
        'full-name': 'Member Example',
        'phone-number': '+14155552671',
      },
      formSnapshotId: updateResponse.body.formSnapshotId as number,
      actionId: testAction.id,
      deviceType: 'desktop' as const,
    };

    const submitResponse = await request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${formId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(submitDto)
      .expect(201);

    expect(submitResponse.body.formId).toBe(formId);

    const meResponse = await request(ctx.app.getHttpServer())
      .get(`/tasks/myResponse/${formId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(meResponse.body.answers['full-name']).toBe('Member Example');

    const aggregateViewsResponse = await request(ctx.app.getHttpServer())
      .get(`/tasks/aggregateViews/${formId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(aggregateViewsResponse.body.aggregateViews).toHaveLength(1);
    expect(aggregateViewsResponse.body.aggregateViews[0].numerator.value).toBe(
      10,
    );

    const user = await userRepo.findOne({ where: { id: ctx.testUserId } });
    expect(user?.phoneNumber).toContain('+1');

    const listResponse = await request(ctx.app.getHttpServer())
      .get('/tasks/listForms')
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    const linked = listResponse.body.find((form) => form.id === formId);
    expect(linked.usedInAction.name).toBe('Form Linked Action');

    const responses = await request(ctx.app.getHttpServer())
      .get(`/tasks/responses/${formId}`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    expect(responses.body.length).toBeGreaterThanOrEqual(1);

    await request(ctx.app.getHttpServer())
      .delete(`/tasks/${formId}`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    await request(ctx.app.getHttpServer())
      .get(`/tasks/slug/${formId}`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .expect(404);
  });

  it('rejects a stale form update that would clobber another edit', async () => {
    const createResponse = await request(ctx.app.getHttpServer())
      .post('/tasks/createForm')
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({ title: 'Volunteer Signup', schema: sampleSchema })
      .expect(201);

    const concFormId = createResponse.body.id as number;
    const snapshot0 = createResponse.body.formSnapshotId as number;

    const schemaV1 = structuredClone(sampleSchema);
    schemaV1.description = 'Concurrency V1';

    const updateV1 = await request(ctx.app.getHttpServer())
      .put(`/tasks/updateForm/${concFormId}`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: 'V1',
        schema: schemaV1,
        expectedFormSnapshotId: snapshot0,
      })
      .expect(200);

    const snapshot1 = updateV1.body.formSnapshotId as number;
    expect(snapshot1).not.toBe(snapshot0);

    const schemaV2 = structuredClone(sampleSchema);
    schemaV2.description = 'Concurrency V2';
    await request(ctx.app.getHttpServer())
      .put(`/tasks/updateForm/${concFormId}`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: 'V2',
        schema: schemaV2,
        expectedFormSnapshotId: snapshot0,
      })
      .expect(409);

    const updateV2 = await request(ctx.app.getHttpServer())
      .put(`/tasks/updateForm/${concFormId}`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: 'V2',
        schema: schemaV2,
        expectedFormSnapshotId: snapshot1,
      })
      .expect(200);
    expect(updateV2.body.formSnapshotId).not.toBe(snapshot1);

    const schemaV3 = structuredClone(sampleSchema);
    schemaV3.description = 'Concurrency V3';
    await request(ctx.app.getHttpServer())
      .put(`/tasks/updateForm/${concFormId}`)
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({ title: 'V3', schema: schemaV3 })
      .expect(200);
  });

  it('sums number field answers into aggregate views', async () => {
    const aggregateSchema: FormSchema = {
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'amount',
              type: 'input',
              kind: 'number',
              label: 'Amount',
              required: true,
            },
          ],
        },
      ],
      outputViews: [],
      aggregateViews: [
        {
          kind: 'progressbar',
          id: 'raised-vs-goal',
          title: 'Raised',
          caption: '',
          numerator: { type: 'numberfield', fieldId: 'amount' },
          denominator: { type: 'number', value: 1000 },
          displayType: 'dollars',
        },
      ],
    };

    const testAction = await actionRepo.save(
      actionRepo.create({
        name: 'Aggregate Number Action',
        category: 'Community',
        body: 'Body copy',
        shortDescription: 'Short copy',
        type: ActionTaskType.Activity,
        isForumParticipationAction: false,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        optional: false,
        publicOnly: false,
        onboarding: false,
        isContractSigningAction: false,
        cohortExpression: {
          type: 'Tag',
          tagId: ctx.defaultTag.id,
        },
        followUpForms: [],
      } satisfies CreateActionDto),
    );

    await eventRepo.save(
      eventRepo.create({
        title: 'Aggregate Number Action',
        description: 'Make non-draft',
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        action: testAction,
      }),
    );

    const createResponse = await request(ctx.app.getHttpServer())
      .post('/tasks/createForm')
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: 'Aggregate Number Form',
        schema: aggregateSchema,
      })
      .expect(201);

    const aggregateFormId = createResponse.body.id as number;
    await actionRepo.update(testAction.id, { taskFormId: aggregateFormId });

    await request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${aggregateFormId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({
        answers: { amount: 250 },
        formSnapshotId: createResponse.body.formSnapshotId as number,
        actionId: testAction.id,
        deviceType: 'desktop' as const,
      })
      .expect(201);

    const aggregateViewsResponse = await request(ctx.app.getHttpServer())
      .get(`/tasks/aggregateViews/${aggregateFormId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(aggregateViewsResponse.body.aggregateViews).toHaveLength(1);
    expect(aggregateViewsResponse.body.aggregateViews[0].numerator.value).toBe(
      250,
    );
    expect(
      aggregateViewsResponse.body.aggregateViews[0].denominator.value,
    ).toBe(1000);
  });

  it('hides privateByDefault output fields in public output while keeping normal output fields visible', async () => {
    const outputSchema: FormSchema = {
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'private-output',
              type: 'input',
              kind: 'text',
              label: 'Private output',
              required: true,
              output: {
                output: true,
                privateByDefault: true,
              },
            },
            {
              id: 'public-output',
              type: 'input',
              kind: 'text',
              label: 'Public output',
              required: true,
              output: {
                output: true,
              },
            },
            {
              id: 'non-output',
              type: 'input',
              kind: 'text',
              label: 'Non output',
            },
          ],
        },
      ],
      outputViews: [],
      aggregateViews: [],
    };

    const action = await actionRepo.save(
      actionRepo.create({
        name: 'Output Visibility Action',
        category: 'Community',
        body: 'Body copy',
        shortDescription: 'Short copy',
        type: ActionTaskType.Activity,
        isForumParticipationAction: false,
        shouldCompleteAfterDeadline: false,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        optional: false,
        publicOnly: false,
        onboarding: false,
        isContractSigningAction: false,
        cohortExpression: {
          type: 'Tag',
          tagId: ctx.defaultTag.id,
        },
        followUpForms: [],
      } satisfies CreateActionDto),
    );

    await eventRepo.save(
      eventRepo.create({
        title: 'Output Visibility Event',
        description: 'Test Action',
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        action,
      }),
    );

    const createFormResponse = await request(ctx.app.getHttpServer())
      .post('/tasks/createForm')
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: 'Output Visibility',
        schema: outputSchema,
      })
      .expect(201);

    const createdFormId = createFormResponse.body.id as number;
    await actionRepo.update(action.id, { taskFormId: createdFormId });

    await request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${createdFormId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({
        answers: {
          'private-output': 'should-be-hidden-by-default',
          'public-output': 'should-be-visible-by-default',
          'non-output': 'not-an-output-field',
        },
        formSnapshotId: createFormResponse.body.formSnapshotId as number,
        actionId: action.id,
        publicAnswers: {
          'private-output': false,
          'public-output': true,
        },
        deviceType: 'desktop' as const,
      })
      .expect(201);

    const activitiesResponse = await request(ctx.app.getHttpServer())
      .get(`/actions/${action.id}/activities`)
      .query({ comments: true })
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .expect(200);

    const completionActivity = activitiesResponse.body.find(
      (activity: { type: ActionActivityType }) =>
        activity.type === ActionActivityType.USER_COMPLETED,
    ) as
      | {
          formResponseOutput?: {
            answers?: Record<string, unknown>;
            publicAnswers?: Record<string, boolean>;
          };
        }
      | undefined;

    expect(completionActivity).toBeDefined();
    expect(completionActivity?.formResponseOutput).toBeDefined();

    const publicAnswers = completionActivity?.formResponseOutput?.publicAnswers;
    const answers = completionActivity?.formResponseOutput?.answers ?? {};
    expect(publicAnswers?.['private-output']).toBe(false);
    expect(publicAnswers?.['public-output']).toBe(true);

    const outputFieldIds = new Set(['private-output', 'public-output']);
    const publicOutputAnswers = Object.fromEntries(
      Object.entries(answers).filter(([fieldId]) => {
        if (!outputFieldIds.has(fieldId)) {
          return false;
        }
        return publicAnswers?.[fieldId] !== false;
      }),
    );

    expect(publicOutputAnswers).toEqual({
      'public-output': 'should-be-visible-by-default',
    });
  });

  describe('Custom validators', () => {
    const createValidator = async (
      type: CustomValidatorType,
      idArgument?: string,
    ): Promise<number> => {
      const response = await request(ctx.app.getHttpServer())
        .post('/tasks/createCustomValidator')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ type, idArgument: idArgument ?? null, expression: null })
        .expect(201);

      return response.body.id;
    };

    it('rejects a create body that omits the nullable fields', async () => {
      await request(ctx.app.getHttpServer())
        .post('/tasks/createCustomValidator')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ type: CustomValidatorType.AnyCommunity })
        .expect(400);
    });

    const runValidator = async (
      id: number,
      fieldValue?: string,
    ): Promise<{ isValid: boolean; message?: string }> => {
      const response = await request(ctx.app.getHttpServer())
        .post(`/tasks/runValidator/${id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send(fieldValue ? { fieldValue } : {})
        .expect(201);

      return response.body;
    };

    const createAction = async (name: string): Promise<Action> => {
      const action = await actionRepo.save(
        actionRepo.create({
          name,
          category: 'Community',
          body: 'Body copy',
          shortDescription: 'Short copy',
          type: ActionTaskType.Activity,
          shouldCompleteAfterDeadline: false,
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          optional: false,
          publicOnly: false,
          isContractSigningAction: false,
          isForumParticipationAction: false,
          onboarding: false,
          followUpForms: [],
          cohortExpression: {
            type: 'Tag',
            tagId: ctx.defaultTag.id,
          },
        } satisfies CreateActionDto),
      );

      await eventRepo.save(
        eventRepo.create({
          title: `${name} Event`,
          description: `${name} Event`,
          newStatus: ActionStatus.MemberAction,
          date: new Date(Date.now() - 1000),
          action,
        }),
      );

      return action;
    };

    it('lists validator types with visibility metadata', async () => {
      const response = await request(ctx.app.getHttpServer())
        .get('/tasks/customValidators')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      const byId = new Map(
        response.body.map(
          (entry: {
            id: CustomValidatorType;
            withIdField: boolean;
            usableForVisibility: boolean;
          }) => [entry.id, entry],
        ),
      );

      for (const type of Object.values(CustomValidatorType)) {
        const entry = byId.get(type) as CustomValidatorTypeDto;
        expect(entry).toBeDefined();
        expect(entry.withIdField).toBe(typeUsesIdArgument[type]);
        expect(entry.usableForVisibility).toBe(typeUsableForVisibility[type]);
      }
    });

    it('reuses validators with matching type and id arguments', async () => {
      const first = await createValidator(CustomValidatorType.AnyCommunity);
      const second = await createValidator(CustomValidatorType.AnyCommunity);
      expect(second).toBe(first);

      const withIdFirst = await createValidator(
        CustomValidatorType.MemberCommunity,
        '123',
      );
      const withIdSecond = await createValidator(
        CustomValidatorType.MemberCommunity,
        '123',
      );
      const withIdThird = await createValidator(
        CustomValidatorType.MemberCommunity,
        '456',
      );
      expect(withIdSecond).toBe(withIdFirst);
      expect(withIdThird).not.toBe(withIdFirst);
    });

    it('validates profile completion requirements', async () => {
      const photoValidatorId = await createValidator(
        CustomValidatorType.UploadedPhoto,
      );
      let result = await runValidator(photoValidatorId);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('profile picture');

      await userRepo.update(ctx.testUserId, { profilePicture: 'pic-key' });
      result = await runValidator(photoValidatorId);
      expect(result.isValid).toBe(true);

      const contractValidatorId = await createValidator(
        CustomValidatorType.SignedContract,
      );
      result = await runValidator(contractValidatorId);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('contract');

      const user = await userRepo.findOneOrFail({
        where: { id: ctx.testUserId },
      });
      await contractEventRepo.save(
        contractEventRepo.create({
          type: ContractEventType.SIGNED,
          date: new Date(Date.now() - 1000),
          user,
          contractId: ctx.defaultContractId,
        }),
      );
      result = await runValidator(contractValidatorId);
      expect(result.isValid).toBe(true);

      const descriptionValidatorId = await createValidator(
        CustomValidatorType.AddedProfileDescription,
      );
      result = await runValidator(descriptionValidatorId);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('profile description');

      await userRepo.update(ctx.testUserId, {
        profileDescription: 'Short bio',
      });
      result = await runValidator(descriptionValidatorId);
      expect(result.isValid).toBe(true);
    });

    it('validates forum reply requirements', async () => {
      const author = await userRepo.findOneOrFail({
        where: { id: ctx.testUserId },
      });

      const post = await postRepo.save(
        postRepo.create({
          title: 'Test Post',
          author,
          authorId: author.id,
          editableContent: editableContentRepo.create({
            body: 'Post body',
            attachments: [],
          }),
        }),
      );

      const validatorId = await createValidator(
        CustomValidatorType.RepliedToForumPost,
        post.id.toString(),
      );
      let result = await runValidator(validatorId);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('replied');

      await commentRepo.save(
        commentRepo.create({
          author,
          authorId: author.id,
          parentObjectType: CommentParentObject.Post,
          parentObjectId: post.id,
          editableContent: editableContentRepo.create({
            body: 'Reply',
            attachments: [],
          }),
        }),
      );

      result = await runValidator(validatorId);
      expect(result.isValid).toBe(true);
    });

    it('distinguishes between top-level and child comments for forum reply validators', async () => {
      const testUser = await userRepo.findOneOrFail({
        where: { id: ctx.testUserId },
      });

      // Create another user to make the initial top-level comment
      const otherUser = await userRepo.findOneOrFail({
        where: { id: ctx.adminUserId },
      });

      const post = await postRepo.save(
        postRepo.create({
          title: 'Discussion Post',
          author: otherUser,
          authorId: otherUser.id,
          editableContent: editableContentRepo.create({
            body: 'Discussion topic',
            attachments: [],
          }),
        }),
      );

      // Create both validators
      const topLevelOnlyValidatorId = await createValidator(
        CustomValidatorType.RepliedToForumPost,
        post.id.toString(),
      );
      const anyReplyValidatorId = await createValidator(
        CustomValidatorType.RepliedToForumPostOrChild,
        post.id.toString(),
      );

      // Initially both should fail
      let topLevelResult = await runValidator(topLevelOnlyValidatorId);
      let anyReplyResult = await runValidator(anyReplyValidatorId);
      expect(topLevelResult.isValid).toBe(false);
      expect(anyReplyResult.isValid).toBe(false);

      // Create a top-level comment from another user (to reply to)
      const otherUserComment = await commentRepo.save(
        commentRepo.create({
          author: otherUser,
          authorId: otherUser.id,
          parentObjectType: CommentParentObject.Post,
          parentObjectId: post.id,
          editableContent: editableContentRepo.create({
            body: 'First comment from other user',
            attachments: [],
          }),
        }),
      );

      // Create a child comment (reply to the other user's comment) by the test user
      await commentRepo.save(
        commentRepo.create({
          author: testUser,
          authorId: testUser.id,
          parentObjectType: CommentParentObject.Post,
          parentObjectId: post.id,
          parentId: otherUserComment.id,
          editableContent: editableContentRepo.create({
            body: 'Reply to comment (child comment)',
            attachments: [],
          }),
        }),
      );

      // RepliedToForumPostOrChild should pass (child comment counts)
      // RepliedToForumPost should fail (only top-level comments count)
      topLevelResult = await runValidator(topLevelOnlyValidatorId);
      anyReplyResult = await runValidator(anyReplyValidatorId);
      expect(topLevelResult.isValid).toBe(false);
      expect(topLevelResult.message).toContain('replied');
      expect(anyReplyResult.isValid).toBe(true);

      // Now add a top-level comment by the test user
      await commentRepo.save(
        commentRepo.create({
          author: testUser,
          authorId: testUser.id,
          parentObjectType: CommentParentObject.Post,
          parentObjectId: post.id,
          editableContent: editableContentRepo.create({
            body: 'Top-level comment from test user',
            attachments: [],
          }),
        }),
      );

      // Both should now pass
      topLevelResult = await runValidator(topLevelOnlyValidatorId);
      anyReplyResult = await runValidator(anyReplyValidatorId);
      expect(topLevelResult.isValid).toBe(true);
      expect(anyReplyResult.isValid).toBe(true);
    });

    it('validates phone number presence and format', async () => {
      const hasPhoneValidatorId = await createValidator(
        CustomValidatorType.HasPhoneNumber,
      );
      let result = await runValidator(hasPhoneValidatorId);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('phone number');

      await userRepo.update(ctx.testUserId, {
        phoneNumber: '+14155552671',
      });
      result = await runValidator(hasPhoneValidatorId);
      expect(result.isValid).toBe(true);

      const phoneValidValidatorId = await createValidator(
        CustomValidatorType.IsPhoneNumberValid,
      );
      result = await runValidator(phoneValidValidatorId);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('phone number');

      result = await runValidator(phoneValidValidatorId, 'not-a-phone');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('include the country code');

      result = await runValidator(phoneValidValidatorId, '+14155552671');
      expect(result.isValid).toBe(true);
    });

    it('accepts the E.164 a phone field now submits, from any country', async () => {
      const phoneValidValidatorId = await createValidator(
        CustomValidatorType.IsPhoneNumberValid,
      );

      for (const submitted of [
        '+14155552671',
        '+447578497969',
        '+33751181445',
        '+525512345678',
      ]) {
        expect(await runValidator(phoneValidValidatorId, submitted)).toEqual({
          isValid: true,
        });
      }
    });

    it('tells a member sending a bare non-US number what is missing', async () => {
      // Legacy clients send national numbers without country metadata.
      const phoneValidValidatorId = await createValidator(
        CustomValidatorType.IsPhoneNumberValid,
      );

      const result = await runValidator(phoneValidValidatorId, '07578497969');

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('country code');
    });

    it('validates tag and community membership', async () => {
      const memberTagValidatorId = await createValidator(
        CustomValidatorType.MemberTag,
        ctx.defaultTag.id.toString(),
      );
      let result = await runValidator(memberTagValidatorId);
      expect(result.isValid).toBe(true);

      const missingTagValidatorId = await createValidator(
        CustomValidatorType.MemberTag,
        `${ctx.defaultTag.id + 999}`,
      );
      result = await runValidator(missingTagValidatorId);
      expect(result.isValid).toBe(false);

      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Test Community',
          description: 'Test Description',
        }),
      );

      const memberCommunityValidatorId = await createValidator(
        CustomValidatorType.MemberCommunity,
        community.id.toString(),
      );
      const anyCommunityValidatorId = await createValidator(
        CustomValidatorType.AnyCommunity,
      );

      result = await runValidator(memberCommunityValidatorId);
      expect(result.isValid).toBe(false);

      result = await runValidator(anyCommunityValidatorId);
      expect(result.isValid).toBe(false);

      const user = await userRepo.findOneOrFail({
        where: { id: ctx.testUserId },
      });
      community.users = [user];
      await communityRepo.save(community);

      result = await runValidator(memberCommunityValidatorId);
      expect(result.isValid).toBe(true);

      result = await runValidator(anyCommunityValidatorId);
      expect(result.isValid).toBe(true);
    });

    it('requires id arguments for validators that need them', async () => {
      const validatorId = await createValidator(
        CustomValidatorType.MemberCommunity,
      );

      await request(ctx.app.getHttpServer())
        .post(`/tasks/runValidator/${validatorId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({})
        .expect(400);
    });

    it('applies visibility validators during submission', async () => {
      const visibilityValidatorId = await createValidator(
        CustomValidatorType.HasPhoneNumber,
      );

      const visibilitySchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'proof',
                type: 'input',
                kind: 'text',
                label: 'Phone proof',
                required: true,
                visibleIfFormula: {
                  conditions: {
                    condition1: {
                      kind: 'validator',
                      validatorId: visibilityValidatorId,
                    },
                  },
                  formula: 'condition1',
                },
              },
            ],
          },
        ],
        outputViews: [],
        aggregateViews: [],
      };

      const actionOne = await createAction('Validator Action One');
      const formOne = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'Validator Visibility', schema: visibilitySchema })
        .expect(201);
      await actionRepo.update(actionOne.id, {
        taskFormId: formOne.body.id as number,
      });

      const submitOne = await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formOne.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {},
          formSnapshotId: formOne.body.formSnapshotId as number,
          actionId: actionOne.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);

      expect(
        submitOne.body.visibilityValidatorResults[visibilityValidatorId],
      ).toBe(false);

      await userRepo.update(ctx.testUserId, {
        phoneNumber: '+14155552671',
      });

      const actionTwo = await createAction('Validator Action Two');
      const formTwo = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: 'Validator Visibility 2',
          schema: visibilitySchema,
        })
        .expect(201);
      await actionRepo.update(actionTwo.id, {
        taskFormId: formTwo.body.id as number,
      });

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formTwo.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {},
          formSnapshotId: formTwo.body.formSnapshotId as number,
          actionId: actionTwo.id,
          deviceType: 'desktop' as const,
        })
        .expect(400);

      const submitTwo = await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formTwo.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { proof: 'Confirmed' },
          formSnapshotId: formTwo.body.formSnapshotId as number,
          actionId: actionTwo.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);

      expect(
        submitTwo.body.visibilityValidatorResults[visibilityValidatorId],
      ).toBe(true);
    });
  });

  describe('Conditional requiredness', () => {
    const requiredIfSchema: FormSchema = {
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'attending',
              type: 'input',
              kind: 'radio',
              label: 'Attending?',
              required: true,
              options: [
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
              ],
            },
            {
              id: 'guest-count',
              type: 'input',
              kind: 'text',
              label: 'Guest count',
              requiredIfFormula: {
                conditions: {
                  c1: { kind: 'equals', when: 'attending', equals: 'yes' },
                },
                formula: 'c1',
              },
            },
          ],
        },
      ],
      outputViews: [],
    };

    const listRequiredIfSchema: FormSchema = {
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'people',
              type: 'input',
              kind: 'list',
              label: 'People',
              fields: [
                {
                  id: 'name',
                  type: 'input',
                  kind: 'text',
                  label: 'Name',
                  required: true,
                },
                {
                  id: 'dietary-notes',
                  type: 'input',
                  kind: 'text',
                  label: 'Dietary notes',
                  requiredIfFormula: {
                    conditions: {
                      c1: {
                        kind: 'equals',
                        when: 'has-restrictions',
                        equals: 'yes',
                      },
                    },
                    formula: 'c1',
                  },
                },
                {
                  id: 'has-restrictions',
                  type: 'input',
                  kind: 'radio',
                  label: 'Dietary restrictions?',
                  required: true,
                  options: [
                    { label: 'Yes', value: 'yes' },
                    { label: 'No', value: 'no' },
                  ],
                },
              ],
            },
          ],
        },
      ],
      outputViews: [],
    };

    /**
     * `required` and `requiredIfFormula` set together on a list and a ranking field:
     * `requiredIfFormula` wins in both directions, including for the list-minimum and
     * ranking-slot checks.
     */
    const listAndRankingRequiredIfSchema: FormSchema = {
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'attending',
              type: 'input',
              kind: 'radio',
              label: 'Attending?',
              required: true,
              options: [
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
              ],
            },
            {
              id: 'people',
              type: 'input',
              kind: 'list',
              label: 'People',
              required: true,
              requiredIfFormula: {
                conditions: {
                  c1: { kind: 'equals', when: 'attending', equals: 'yes' },
                },
                formula: 'c1',
              },
              fields: [
                {
                  id: 'name',
                  type: 'input',
                  kind: 'text',
                  label: 'Name',
                  required: true,
                },
              ],
            },
            {
              id: 'priorities',
              type: 'input',
              kind: 'ranking',
              label: 'Priorities',
              required: true,
              requiredIfFormula: {
                conditions: {
                  c1: { kind: 'equals', when: 'attending', equals: 'yes' },
                },
                formula: 'c1',
              },
              options: [
                { label: 'Food', value: 'food' },
                { label: 'Music', value: 'music' },
              ],
            },
          ],
        },
      ],
      outputViews: [],
    };

    const createRequiredIfForm = async (
      name: string,
      schema: FormSchema = requiredIfSchema,
    ): Promise<{
      formId: number;
      formSnapshotId: number;
      actionId: number;
    }> => {
      const action = await createAction(name);
      const form = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: name, schema })
        .expect(201);
      await actionRepo.update(action.id, {
        taskFormId: form.body.id as number,
      });
      return {
        formId: form.body.id as number,
        formSnapshotId: form.body.formSnapshotId as number,
        actionId: action.id,
      };
    };

    it('rejects a submission missing a field its requiredIfFormula demands', async () => {
      const { formId, formSnapshotId, actionId } =
        await createRequiredIfForm('RequiredIf Missing');

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { attending: 'yes' },
          formSnapshotId,
          actionId,
          deviceType: 'desktop' as const,
        })
        .expect(400);
    });

    it('accepts the same submission once the field is answered', async () => {
      const { formId, formSnapshotId, actionId } = await createRequiredIfForm(
        'RequiredIf Answered',
      );

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { attending: 'yes', 'guest-count': '2' },
          formSnapshotId,
          actionId,
          deviceType: 'desktop' as const,
        })
        .expect(201);
    });

    it('accepts a submission when the requiredIfFormula is false', async () => {
      const { formId, formSnapshotId, actionId } = await createRequiredIfForm(
        'RequiredIf Not Triggered',
      );

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { attending: 'no' },
          formSnapshotId,
          actionId,
          deviceType: 'desktop' as const,
        })
        .expect(201);
    });

    it('rejects a list item missing a sub-field its requiredIfFormula demands', async () => {
      const { formId, formSnapshotId, actionId } = await createRequiredIfForm(
        'RequiredIf List Missing',
        listRequiredIfSchema,
      );

      const response = await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            people: [
              { name: 'Ada', 'has-restrictions': 'no' },
              // Second item triggers the sub-field's requiredIfFormula but omits it.
              { name: 'Grace', 'has-restrictions': 'yes' },
            ],
          },
          formSnapshotId,
          actionId,
          deviceType: 'desktop' as const,
        })
        .expect(400);

      expect(response.body.message).toBe(
        'Field People (item 2): Dietary notes is required.',
      );
    });

    it('accepts list items that satisfy or do not trigger the sub-field requiredIfFormula', async () => {
      const { formId, formSnapshotId, actionId } = await createRequiredIfForm(
        'RequiredIf List Answered',
        listRequiredIfSchema,
      );

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            people: [
              { name: 'Ada', 'has-restrictions': 'no' },
              {
                name: 'Grace',
                'has-restrictions': 'yes',
                'dietary-notes': 'No shellfish',
              },
            ],
          },
          formSnapshotId,
          actionId,
          deviceType: 'desktop' as const,
        })
        .expect(201);
    });

    it('does not enforce list/ranking requiredness when requiredIfFormula is false', async () => {
      const { formId, formSnapshotId, actionId } = await createRequiredIfForm(
        'RequiredIf List And Ranking Not Triggered',
        listAndRankingRequiredIfSchema,
      );

      // Both fields are statically `required`, but their requiredIfFormula is false —
      // an empty list and a partial ranking have to be accepted, matching what
      // the client lets through.
      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { attending: 'no', people: [], priorities: ['food'] },
          formSnapshotId,
          actionId,
          deviceType: 'desktop' as const,
        })
        .expect(201);
    });

    it('rejects an empty list when its requiredIfFormula is true', async () => {
      const { formId, formSnapshotId, actionId } = await createRequiredIfForm(
        'RequiredIf List Triggered',
        listAndRankingRequiredIfSchema,
      );

      const response = await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { attending: 'yes', people: [], priorities: [] },
          formSnapshotId,
          actionId,
          deviceType: 'desktop' as const,
        })
        .expect(400);

      expect(response.body.message).toBe('Field People is required');
    });

    it('rejects a partial ranking when its requiredIfFormula is true', async () => {
      const { formId, formSnapshotId, actionId } = await createRequiredIfForm(
        'RequiredIf Ranking Triggered',
        listAndRankingRequiredIfSchema,
      );

      const response = await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            attending: 'yes',
            people: [{ name: 'Ada' }],
            priorities: ['food'],
          },
          formSnapshotId,
          actionId,
          deviceType: 'desktop' as const,
        })
        .expect(400);

      expect(response.body.message).toBe(
        'Field Priorities requires ranking 2 items.',
      );
    });

    it('accepts a list and ranking that satisfy a true requiredIfFormula', async () => {
      const { formId, formSnapshotId, actionId } = await createRequiredIfForm(
        'RequiredIf List And Ranking Answered',
        listAndRankingRequiredIfSchema,
      );

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            attending: 'yes',
            people: [{ name: 'Ada' }],
            priorities: ['food', 'music'],
          },
          formSnapshotId,
          actionId,
          deviceType: 'desktop' as const,
        })
        .expect(201);
    });
  });

  /**
   * `submitForm` fetches only the account values a schema's conditions actually
   * read (see `getVisibilityContext`'s `kinds` argument). These cover each kind
   * end to end: if a kind were fetched with the wrong query — or not fetched at
   * all — its condition would silently evaluate against the guest default and
   * the gated field would stop being enforced.
   */
  describe('Account-derived condition visibility', () => {
    /** A form whose one required field is gated on a single account condition. */
    const gatedSchema = (condition: Condition): FormSchema => ({
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'always-shown',
              type: 'input',
              kind: 'text',
              label: 'Always shown',
              required: true,
            },
            {
              id: 'gated',
              type: 'input',
              kind: 'text',
              label: 'Gated',
              required: true,
              visibleIfFormula: {
                conditions: { c1: condition },
                formula: 'c1',
              },
            },
          ],
        },
      ],
      outputViews: [],
    });

    /** Submits `{ 'always-shown': 'x' }` — never the gated field. */
    const submitWithoutGatedField = async (
      name: string,
      condition: Condition,
    ): Promise<number> => {
      const action = await createAction(name);
      const form = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: name, schema: gatedSchema(condition) })
        .expect(201);
      await actionRepo.update(action.id, {
        taskFormId: form.body.id as number,
      });

      const response = await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${form.body.id as number}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { 'always-shown': 'x' },
          formSnapshotId: form.body.formSnapshotId as number,
          actionId: action.id,
          deviceType: 'desktop' as const,
        });
      return response.status;
    };

    it('enforces a completedActionCount-gated field only once the count is reached', async () => {
      const condition: Condition = { kind: 'completedActionCount', atLeast: 1 };
      expect(
        await submitWithoutGatedField('Count Not Reached', condition),
      ).toBe(201);

      const completed = await createAction('Something Completed');
      await actionActivityRepo.save(
        actionActivityRepo.create({
          actionId: completed.id,
          userId: ctx.testUserId,
          type: ActionActivityType.USER_COMPLETED,
        }),
      );

      expect(await submitWithoutGatedField('Count Reached', condition)).toBe(
        400,
      );
    });

    it('enforces a userHasCity-gated field only once the user has a city', async () => {
      const condition: Condition = { kind: 'userHasCity', userHasCity: true };
      expect(await submitWithoutGatedField('No City', condition)).toBe(201);

      await userRepo.update(ctx.testUserId, {
        customCityString: 'Springfield',
      });

      expect(await submitWithoutGatedField('Has City', condition)).toBe(400);
    });

    it('enforces a firstContractSigned-gated field only once a contract is signed', async () => {
      const condition: Condition = {
        kind: 'firstContractSigned',
        comparison: 'before',
        date: '2030-01-01T00:00:00.000Z',
      };
      expect(await submitWithoutGatedField('Never Signed', condition)).toBe(
        201,
      );

      const user = await userRepo.findOneOrFail({
        where: { id: ctx.testUserId },
      });
      await contractEventRepo.save(
        contractEventRepo.create({
          type: ContractEventType.SIGNED,
          date: new Date('2026-01-01T00:00:00.000Z'),
          user,
          contractId: ctx.defaultContractId,
        }),
      );

      expect(await submitWithoutGatedField('Signed', condition)).toBe(400);
    });

    /**
     * A snapshot can outlive the server that wrote it (a rollback, or a
     * mid-deploy instance). `evaluateCondition` reports a kind it doesn't know
     * as "not met" so older clients degrade instead of crashing, but taking
     * that answer here would strip the answers the condition gates — so submit
     * refuses the schema instead.
     */
    it('refuses a submission whose schema uses an unsupported condition kind', async () => {
      const name = 'Unsupported Condition Kind';
      const action = await createAction(name);
      const form = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          title: name,
          schema: gatedSchema({
            kind: 'completedActionCount',
            atLeast: 1,
          }),
        })
        .expect(201);
      await actionRepo.update(action.id, {
        taskFormId: form.body.id as number,
      });

      // Rewrite the stored snapshot to the shape a newer build would have
      // written; `createForm` would reject this kind up front.
      const snapshotId = form.body.formSnapshotId as number;
      const [stored] = (await ctx.dataSource.query(
        'SELECT schema FROM form_snapshot WHERE id = $1',
        [snapshotId],
      )) as [{ schema: FormSchema }];
      const rewritten = JSON.stringify(stored.schema).replace(
        '"kind":"completedActionCount","atLeast":1',
        '"kind":"somethingAddedLater","atLeast":1',
      );
      await ctx.dataSource.query(
        'UPDATE form_snapshot SET schema = $1 WHERE id = $2',
        [rewritten, snapshotId],
      );

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${form.body.id as number}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { 'always-shown': 'x' },
          formSnapshotId: snapshotId,
          actionId: action.id,
          deviceType: 'desktop' as const,
        })
        .expect(500);
    });
  });

  describe('Cross-form conditional visibility', () => {
    it('hides required fields when sourceFormId condition is not met', async () => {
      const sourceSchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'role',
                type: 'input',
                kind: 'radio',
                label: 'Role',
                required: true,
                options: [
                  { label: 'Volunteer', value: 'volunteer' },
                  { label: 'Organizer', value: 'organizer' },
                ],
              },
            ],
          },
        ],
        outputViews: [],
      };

      const sourceAction = await createAction('Source Action');
      const sourceFormRes = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'Source Form', schema: sourceSchema })
        .expect(201);
      const sourceFormId = sourceFormRes.body.id as number;
      await actionRepo.update(sourceAction.id, { taskFormId: sourceFormId });

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${sourceFormId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { role: 'volunteer' },
          formSnapshotId: sourceFormRes.body.formSnapshotId as number,
          actionId: sourceAction.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);

      const dependentSchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'general-question',
                type: 'input',
                kind: 'text',
                label: 'General question',
                required: true,
              },
              {
                id: 'organizer-detail',
                type: 'input',
                kind: 'text',
                label: 'Organizer detail',
                required: true,
                visibleIfFormula: {
                  conditions: {
                    condition1: {
                      kind: 'equals',
                      when: 'role',
                      equals: 'organizer',
                      sourceFormId,
                    },
                  },
                  formula: 'condition1',
                },
              },
            ],
          },
        ],
        outputViews: [],
      };

      const dependentAction = await createAction('Dependent Action');
      const dependentFormRes = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'Dependent Form', schema: dependentSchema })
        .expect(201);
      const dependentFormId = dependentFormRes.body.id as number;
      await actionRepo.update(dependentAction.id, {
        taskFormId: dependentFormId,
      });

      // Submit without organizer-detail (it should be hidden because source answer = 'volunteer')
      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${dependentFormId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { 'general-question': 'Hello' },
          formSnapshotId: dependentFormRes.body.formSnapshotId as number,
          actionId: dependentAction.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);
    });

    it('shows required fields when sourceFormId condition is met', async () => {
      const sourceSchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'role',
                type: 'input',
                kind: 'radio',
                label: 'Role',
                required: true,
                options: [
                  { label: 'Volunteer', value: 'volunteer' },
                  { label: 'Organizer', value: 'organizer' },
                ],
              },
            ],
          },
        ],
        outputViews: [],
      };

      const sourceAction = await createAction('Source Action 2');
      const sourceFormRes = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'Source Form 2', schema: sourceSchema })
        .expect(201);
      const sourceFormId = sourceFormRes.body.id as number;
      await actionRepo.update(sourceAction.id, { taskFormId: sourceFormId });

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${sourceFormId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { role: 'organizer' },
          formSnapshotId: sourceFormRes.body.formSnapshotId as number,
          actionId: sourceAction.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);

      const dependentSchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'organizer-detail',
                type: 'input',
                kind: 'text',
                label: 'Organizer detail',
                required: true,
                visibleIfFormula: {
                  conditions: {
                    condition1: {
                      kind: 'equals',
                      when: 'role',
                      equals: 'organizer',
                      sourceFormId,
                    },
                  },
                  formula: 'condition1',
                },
              },
            ],
          },
        ],
        outputViews: [],
      };

      const dependentAction = await createAction('Dependent Action 2');
      const dependentFormRes = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'Dependent Form 2', schema: dependentSchema })
        .expect(201);
      const dependentFormId = dependentFormRes.body.id as number;
      await actionRepo.update(dependentAction.id, {
        taskFormId: dependentFormId,
      });

      // Submit without the required field — should fail because condition IS met
      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${dependentFormId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {},
          formSnapshotId: dependentFormRes.body.formSnapshotId as number,
          actionId: dependentAction.id,
          deviceType: 'desktop' as const,
        })
        .expect(400);

      // Submit with the field — should succeed
      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${dependentFormId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { 'organizer-detail': 'My organizer info' },
          formSnapshotId: dependentFormRes.body.formSnapshotId as number,
          actionId: dependentAction.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);
    });

    it('works with visibility formula and sourceFormId', async () => {
      const sourceSchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'interest',
                type: 'input',
                kind: 'radio',
                label: 'Interest',
                required: true,
                options: [
                  { label: 'Tech', value: 'tech' },
                  { label: 'Art', value: 'art' },
                ],
              },
            ],
          },
        ],
        outputViews: [],
      };

      const sourceAction = await createAction('Source Action 3');
      const sourceFormRes = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'Source Form 3', schema: sourceSchema })
        .expect(201);
      const sourceFormId = sourceFormRes.body.id as number;
      await actionRepo.update(sourceAction.id, { taskFormId: sourceFormId });

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${sourceFormId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { interest: 'tech' },
          formSnapshotId: sourceFormRes.body.formSnapshotId as number,
          actionId: sourceAction.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);

      const dependentSchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'tech-question',
                type: 'input',
                kind: 'text',
                label: 'Tech question',
                required: true,
                visibleIfFormula: {
                  conditions: {
                    isTech: {
                      kind: 'equals',
                      when: 'interest',
                      equals: 'tech',
                      sourceFormId,
                    },
                  },
                  formula: 'isTech',
                },
              },
            ],
          },
        ],
        outputViews: [],
      };

      const dependentAction = await createAction('Dependent Action 3');
      const dependentFormRes = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'Dependent Form 3', schema: dependentSchema })
        .expect(201);
      const dependentFormId = dependentFormRes.body.id as number;
      await actionRepo.update(dependentAction.id, {
        taskFormId: dependentFormId,
      });

      // Field IS visible because source answer = 'tech', so omitting it should fail
      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${dependentFormId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {},
          formSnapshotId: dependentFormRes.body.formSnapshotId as number,
          actionId: dependentAction.id,
          deviceType: 'desktop' as const,
        })
        .expect(400);

      // Providing the answer should succeed
      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${dependentFormId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { 'tech-question': 'I love TypeScript' },
          formSnapshotId: dependentFormRes.body.formSnapshotId as number,
          actionId: dependentAction.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);
    });
  });

  describe('Ranking field validation', () => {
    const rankingOptions = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
      { label: 'D', value: 'd' },
    ];

    const optionalRankingField: RankingField = {
      id: 'rank',
      type: 'input',
      kind: 'ranking',
      label: 'Rank these',
      options: rankingOptions,
    };

    const setupForm = async (
      title: string,
      fields: FormSchema['pages'][number]['fields'],
    ) => {
      const action = await createAction(`${title} Action`);
      const formRes = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          title,
          schema: {
            pages: [{ id: 'page-1', fields }],
            outputViews: [],
          } satisfies FormSchema,
        })
        .expect(201);
      const formId = formRes.body.id as number;
      await actionRepo.update(action.id, { taskFormId: formId });
      return {
        formId,
        formSnapshotId: formRes.body.formSnapshotId as number,
        actionId: action.id,
      };
    };

    const submit = (
      form: Awaited<ReturnType<typeof setupForm>>,
      answers: Record<string, unknown>,
    ) =>
      request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${form.formId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers,
          formSnapshotId: form.formSnapshotId,
          actionId: form.actionId,
          deviceType: 'desktop' as const,
        });

    it('rejects invalid and incomplete rankings for a required field', async () => {
      const form = await setupForm('Required Ranking', [
        {
          ...optionalRankingField,
          required: true,
          numToRank: 2,
        },
      ]);

      const missing = await submit(form, {}).expect(400);
      expect(missing.body.message).toContain('is required');

      const partial = await submit(form, { rank: ['a'] }).expect(400);
      expect(partial.body.message).toContain('requires ranking 2 items');

      const duplicate = await submit(form, { rank: ['a', 'a'] }).expect(400);
      expect(duplicate.body.message).toContain('invalid ranking');

      const unknown = await submit(form, { rank: ['a', 'nope'] }).expect(400);
      expect(unknown.body.message).toContain('invalid ranking');

      const overflow = await submit(form, { rank: ['a', 'b', 'c'] }).expect(
        400,
      );
      expect(overflow.body.message).toContain('invalid ranking');

      await submit(form, { rank: ['b', 'a'] }).expect(201);
    });

    it('accepts omitted, null, and partial answers for an optional ranking', async () => {
      const omitted = await setupForm('Optional Ranking Omitted', [
        optionalRankingField,
      ]);
      // Invalid shapes are still rejected even when the field is optional.
      await submit(omitted, { rank: 'a' }).expect(400);
      await submit(omitted, {}).expect(201);

      const nullAnswer = await setupForm('Optional Ranking Null', [
        optionalRankingField,
      ]);
      await submit(nullAnswer, { rank: null }).expect(201);

      const partial = await setupForm('Optional Ranking Partial', [
        optionalRankingField,
      ]);
      await submit(partial, { rank: ['c'] }).expect(201);
    });

    it('skips ranking validation when the field is hidden', async () => {
      const form = await setupForm('Hidden Ranking', [
        {
          id: 'role',
          type: 'input',
          kind: 'radio',
          label: 'Role',
          required: true,
          options: [
            { label: 'Volunteer', value: 'volunteer' },
            { label: 'Organizer', value: 'organizer' },
          ],
        },
        {
          ...optionalRankingField,
          required: true,
          visibleIfFormula: {
            conditions: {
              condition1: {
                kind: 'equals',
                when: 'role',
                equals: 'organizer',
              },
            },
            formula: 'condition1',
          },
        },
      ]);

      // Visible (role = organizer) and unanswered: the requirement applies.
      await submit(form, { role: 'organizer' }).expect(400);
      // Hidden (role = volunteer): the required ranking doesn't apply.
      await submit(form, { role: 'volunteer' }).expect(201);
    });
  });

  describe('User field extraction from form submission', () => {
    it('extracts and saves user fields', async () => {
      // Set up initial user state with a profileDescription
      const initialDescription =
        'This is my profile description that should not be deleted';
      await userRepo.update(ctx.testUserId, {
        profileDescription: initialDescription,
        phoneNumber: null,
        timeZone: null as unknown as string,
        customCityString: null,
        shareInfoPublicly: false,
      });

      const extractionSchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'phone-field',
                type: 'input',
                kind: 'phone',
                label: 'Phone Number',
                autoExtractUserData: true,
              },
              {
                id: 'timezone-field',
                type: 'input',
                kind: 'timezone',
                label: 'Time Zone',
                autoExtractUserData: true,
              },
              {
                id: 'city-field',
                type: 'input',
                kind: 'city',
                label: 'City',
                autoExtractUserData: true,
              },
              {
                id: 'share-publicly-field',
                type: 'input',
                kind: 'checkbox',
                label: 'Share my info publicly',
                autoExtractUserData: { target: 'shareInfoPublicly' },
              },
            ],
          },
        ],
        outputViews: [],
        aggregateViews: [],
      };

      const action = await createAction('Extraction Test Action');
      const formResponse = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'User Data Extraction Form', schema: extractionSchema })
        .expect(201);

      const testFormId = formResponse.body.id;
      await actionRepo.update(action.id, { taskFormId: testFormId as number });

      // Submit form with auto-extract data
      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${testFormId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            'phone-field': '+14155551234',
            'timezone-field': 'America/New_York',
            'city-field': 'Custom City Name',
            'share-publicly-field': true,
          },
          formSnapshotId: formResponse.body.formSnapshotId as number,
          actionId: action.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);

      // Verify user was updated correctly
      const updatedUser = await userRepo.findOne({
        where: { id: ctx.testUserId },
      });

      // Verify extracted fields were saved
      expect(updatedUser?.phoneNumber).toBe('+14155551234');
      expect(updatedUser?.timeZone).toBe('America/New_York');
      expect(updatedUser?.customCityString).toBe('Custom City Name');
      expect(updatedUser?.shareInfoPublicly).toBe(true);
      expect(updatedUser?.profileDescription).toBe(initialDescription);
    });

    it('extracts a non-US number, which is what the picker unblocks', async () => {
      await userRepo.update(ctx.testUserId, { phoneNumber: null });

      const schema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'phone-field',
                type: 'input',
                kind: 'phone',
                label: 'Phone Number',
                autoExtractUserData: true,
              },
            ],
          },
        ],
        outputViews: [],
        aggregateViews: [],
      };

      const action = await createAction('Non-US Phone Action');
      const formResponse = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'Non-US Phone Form', schema })
        .expect(201);
      await actionRepo.update(action.id, {
        taskFormId: formResponse.body.id as number,
      });

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formResponse.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { 'phone-field': '+447578497969' },
          formSnapshotId: formResponse.body.formSnapshotId as number,
          actionId: action.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);

      const updatedUser = await userRepo.findOne({
        where: { id: ctx.testUserId },
      });

      expect(updatedUser?.phoneNumber).toBe('+447578497969');
    });

    it.each([
      ['09:30', '09:30:00'],
      ['9:30', '09:30:00'],
      ['  09:30  ', '09:30:00'],
    ])(
      'extracts preferredReminderTime %p from time field as %p',
      async (answer, stored) => {
        const initialDescription = 'Another description that should persist';
        await userRepo.update(ctx.testUserId, {
          profileDescription: initialDescription,
          preferredReminderTime: null,
        });

        const timeSchema: FormSchema = {
          pages: [
            {
              id: 'page-1',
              fields: [
                {
                  id: 'time-field',
                  type: 'input',
                  kind: 'time',
                  label: 'Preferred Reminder Time',
                  autoExtractUserData: true,
                },
              ],
            },
          ],
          outputViews: [],
          aggregateViews: [],
        };

        const action = await createAction(`Time Extraction Action ${answer}`);
        const formResponse = await request(ctx.app.getHttpServer())
          .post('/tasks/createForm')
          .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
          .send({ title: 'Time Extraction Form', schema: timeSchema })
          .expect(201);
        await actionRepo.update(action.id, {
          taskFormId: formResponse.body.id as number,
        });

        await request(ctx.app.getHttpServer())
          .post(`/tasks/submitForm/${formResponse.body.id}`)
          .set('Authorization', `Bearer ${ctx.accessToken}`)
          .send({
            answers: {
              'time-field': answer,
            },
            formSnapshotId: formResponse.body.formSnapshotId as number,
            actionId: action.id,
            deviceType: 'desktop' as const,
          })
          .expect(201);

        const updatedUser = await userRepo.findOne({
          where: { id: ctx.testUserId },
        });

        expect(updatedUser?.preferredReminderTime?.toString()).toBe(stored);
        expect(updatedUser?.profileDescription).toBe(initialDescription);
      },
    );

    it('does not update user fields when form has no auto-extract fields', async () => {
      const initialDescription = 'Description that must not change';
      const initialPhone = '+14155559999';
      await userRepo.update(ctx.testUserId, {
        profileDescription: initialDescription,
        phoneNumber: initialPhone,
        shareInfoPublicly: true,
      });

      const noExtractSchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'regular-text',
                type: 'input',
                kind: 'text',
                label: 'Regular Text Field',
              },
              {
                id: 'regular-checkbox',
                type: 'input',
                kind: 'checkbox',
                label: 'Regular Checkbox',
              },
            ],
          },
        ],
        outputViews: [],
        aggregateViews: [],
      };

      const action = await createAction('No Extraction Action');
      const formResponse = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'No Extraction Form', schema: noExtractSchema })
        .expect(201);
      await actionRepo.update(action.id, {
        taskFormId: formResponse.body.id as number,
      });

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formResponse.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            'regular-text': 'Some text',
            'regular-checkbox': false,
          },
          formSnapshotId: formResponse.body.formSnapshotId as number,
          actionId: action.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);

      const updatedUser = await userRepo.findOne({
        where: { id: ctx.testUserId },
      });

      // All user fields should remain unchanged
      expect(updatedUser?.profileDescription).toBe(initialDescription);
      expect(updatedUser?.phoneNumber).toBe(initialPhone);
      expect(updatedUser?.shareInfoPublicly).toBe(true);
    });

    it('does not overwrite the profile with an invalid phone number', async () => {
      const initialPhoneNumber = '+14155552671';
      await userRepo.update(ctx.testUserId, {
        phoneNumber: initialPhoneNumber,
      });

      const phoneSchema: FormSchema = {
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'phone-field',
                type: 'input',
                kind: 'phone',
                label: 'Phone',
                autoExtractUserData: true,
              },
            ],
          },
        ],
        outputViews: [],
        aggregateViews: [],
      };

      const action = await createAction('Invalid Phone Action');
      const formResponse = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: 'Invalid Phone Form', schema: phoneSchema })
        .expect(201);
      await actionRepo.update(action.id, {
        taskFormId: formResponse.body.id as number,
      });

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formResponse.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            'phone-field': 'not-a-valid-phone',
          },
          formSnapshotId: formResponse.body.formSnapshotId as number,
          actionId: action.id,
          deviceType: 'desktop' as const,
        })
        .expect(201);

      const updatedUser = await userRepo.findOne({
        where: { id: ctx.testUserId },
      });

      expect(updatedUser?.phoneNumber).toBe(initialPhoneNumber);
    });
  });
});
