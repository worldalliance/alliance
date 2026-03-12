import request from 'supertest';
import type { Repository } from 'typeorm';
import { createTestApp, TestContext } from './e2e-test-utils';
import { TasksModule } from 'src/tasks/tasks.module';
import { Form } from 'src/tasks/entities/form.entity';
import { FormResponse } from 'src/tasks/entities/formresponse.entity';
import {
  Action,
  ActionTaskType,
  VisibilityMode,
} from 'src/actions/entities/action.entity';
import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import { User } from 'src/user/entities/user.entity';
import { FormSchema } from 'src/tasks/schema';
import {
  ActionActivity,
  ActionActivityType,
} from 'src/actions/entities/action-activity.entity';
import { CreateActionDto } from 'src/actions/dto/action.dto';
import {
  CustomValidator,
  CustomValidatorType,
  typeUsableForVisibility,
  typeUsesIdArgument,
} from 'src/tasks/entities/customvalidator.entity';
import {
  ContractEvent,
  ContractEventType,
} from 'src/user/entities/contract-event.entity';
import { Community } from 'src/community/entities/community.entity';
import {
  Comment,
  CommentParentObject,
} from 'src/forum/entities/comment.entity';
import { Post } from 'src/forum/entities/post.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { CustomValidatorTypeDto } from 'src/tasks/customvalidator.dto';

const sampleSchema: FormSchema = {
  title: 'Volunteer Signup',
  pages: [
    {
      id: 'page-1',
      fields: [
        {
          id: 'hero-image',
          kind: 'image',
          alt: 'Hero Image',
          src: 'local-image-key',
        },
        {
          id: 'full-name',
          kind: 'text',
          label: 'Full name',
          required: true,
        },
        {
          id: 'phone-number',
          kind: 'phone',
          label: 'Phone Number',
          autoExtractUserData: true,
        },
      ],
    },
  ],
  outputViews: [],
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
      phoneNumber: null as unknown as string,
      phoneNumberValidated: false,
      profilePicture: null as unknown as string,
      profileDescription: null as unknown as string,
      timeZone: null as unknown as string,
      customCityString: null as unknown as string,
      shareInfoPublicly: false,
      preferredReminderTime: null as unknown as string,
    });
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('supports the full admin and member lifecycle for forms', async () => {
    const testAction = await actionRepo.save(
      actionRepo.create({
        name: 'Test Action',
        category: 'Community',
        body: 'Body copy',
        shortDescription: 'Short copy',
        type: ActionTaskType.Activity,
        commitmentless: true,
        isForumParticipationAction: false,
        everyoneShouldComplete: false,
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
        latestMemberActionEvent: {
          event: null,
          deadline: null,
        },
        followUpForms: [],
      } satisfies CreateActionDto),
    );

    await eventRepo.save(
      eventRepo.create({
        title: 'Test Action',
        description: 'Test Action',
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        action: testAction,
      }),
    );

    const createResponse = await request(ctx.app.getHttpServer())
      .post('/tasks/createForm')
      .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
      .send({
        title: sampleSchema.title,
        schema: sampleSchema,
      })
      .expect(201);

    formId = createResponse.body.id;
    expect(createResponse.body.title).toBe('Volunteer Signup');

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
      schemaSnapshot: sampleSchema,
      actionId: testAction.id,
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

    const user = await userRepo.findOne({ where: { id: ctx.testUserId } });
    expect(user?.phoneNumberValidated).toBe(true);
    expect(user?.phoneNumber).toContain('+1');

    const action = await actionRepo.save(
      actionRepo.create({
        name: 'Form Linked Action',
        category: 'Community',
        body: 'Body copy',
        shortDescription: 'Short copy',
        taskContents: 'Tasks',
        taskFormId: formId,
        cohortExpression: {
          type: 'Tag',
          tagId: ctx.defaultTag.id,
        },
      }),
    );

    await eventRepo.save(
      eventRepo.create({
        title: 'Status Event',
        description: 'Make non-draft',
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        action,
      }),
    );

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

  it('hides privateByDefault output fields in public output while keeping normal output fields visible', async () => {
    const outputSchema: FormSchema = {
      title: 'Output Visibility',
      pages: [
        {
          id: 'page-1',
          fields: [
            {
              id: 'private-output',
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
              kind: 'text',
              label: 'Public output',
              required: true,
              output: {
                output: true,
              },
            },
            {
              id: 'non-output',
              kind: 'text',
              label: 'Non output',
            },
          ],
        },
      ],
      outputViews: [],
    };

    const action = await actionRepo.save(
      actionRepo.create({
        name: 'Output Visibility Action',
        category: 'Community',
        body: 'Body copy',
        shortDescription: 'Short copy',
        type: ActionTaskType.Activity,
        commitmentless: true,
        isForumParticipationAction: false,
        everyoneShouldComplete: false,
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
        latestMemberActionEvent: {
          event: null,
          deadline: null,
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
        title: outputSchema.title,
        schema: outputSchema,
      })
      .expect(201);

    const createdFormId = createFormResponse.body.id as number;

    await request(ctx.app.getHttpServer())
      .post(`/tasks/submitForm/${createdFormId}`)
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({
        answers: {
          'private-output': 'should-be-hidden-by-default',
          'public-output': 'should-be-visible-by-default',
          'non-output': 'not-an-output-field',
        },
        schemaSnapshot: outputSchema,
        actionId: action.id,
        publicAnswers: {
          'private-output': false,
          'public-output': true,
        },
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
        .send({ type, idArgument })
        .expect(201);

      return response.body.id;
    };

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
          commitmentless: true,
          everyoneShouldComplete: false,
          shouldCompleteAfterDeadline: false,
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          optional: false,
          publicOnly: false,
          isContractSigningAction: false,
          isForumParticipationAction: false,
          latestMemberActionEvent: {
            event: null,
            deadline: null,
          },
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
      expect(result.message).toBe('Could not validate phone number');

      result = await runValidator(phoneValidValidatorId, '+14155552671');
      expect(result.isValid).toBe(true);
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
        title: 'Validator Visibility',
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'proof',
                kind: 'text',
                label: 'Phone proof',
                required: true,
                visibleIf: [{ validatorId: visibilityValidatorId }],
              },
            ],
          },
        ],
        outputViews: [],
      };

      const actionOne = await createAction('Validator Action One');
      const formOne = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: visibilitySchema.title, schema: visibilitySchema })
        .expect(201);

      const submitOne = await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formOne.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {},
          schemaSnapshot: visibilitySchema,
          actionId: actionOne.id,
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
          title: `${visibilitySchema.title} 2`,
          schema: visibilitySchema,
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formTwo.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {},
          schemaSnapshot: visibilitySchema,
          actionId: actionTwo.id,
        })
        .expect(400);

      const submitTwo = await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formTwo.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: { proof: 'Confirmed' },
          schemaSnapshot: visibilitySchema,
          actionId: actionTwo.id,
        })
        .expect(201);

      expect(
        submitTwo.body.visibilityValidatorResults[visibilityValidatorId],
      ).toBe(true);
    });
  });

  describe('User field extraction from form submission', () => {
    const createAction = async (name: string): Promise<Action> => {
      const action = await actionRepo.save(
        actionRepo.create({
          name,
          category: 'Community',
          body: 'Body copy',
          shortDescription: 'Short copy',
          type: ActionTaskType.Activity,
          commitmentless: true,
          isForumParticipationAction: false,
          everyoneShouldComplete: false,
          shouldCompleteAfterDeadline: false,
          visibilityMode: VisibilityMode.Public,
          preventCompletion: false,
          optional: false,
          publicOnly: false,
          isContractSigningAction: false,
          latestMemberActionEvent: {
            event: null,
            deadline: null,
          },
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

    it('extracts and saves user fields', async () => {
      // Set up initial user state with a profileDescription
      const initialDescription =
        'This is my profile description that should not be deleted';
      await userRepo.update(ctx.testUserId, {
        profileDescription: initialDescription,
        phoneNumber: null as unknown as string,
        phoneNumberValidated: false,
        timeZone: null as unknown as string,
        customCityString: null as unknown as string,
        shareInfoPublicly: false,
      });

      const extractionSchema: FormSchema = {
        title: 'User Data Extraction Form',
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'phone-field',
                kind: 'phone',
                label: 'Phone Number',
                autoExtractUserData: true,
              },
              {
                id: 'timezone-field',
                kind: 'timezone',
                label: 'Time Zone',
                autoExtractUserData: true,
              },
              {
                id: 'city-field',
                kind: 'city',
                label: 'City',
                autoExtractUserData: true,
              },
              {
                id: 'share-publicly-field',
                kind: 'checkbox',
                label: 'Share my info publicly',
                autoExtractUserData: { target: 'shareInfoPublicly' },
              },
            ],
          },
        ],
        outputViews: [],
      };

      const action = await createAction('Extraction Test Action');
      const formResponse = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: extractionSchema.title, schema: extractionSchema })
        .expect(201);

      const testFormId = formResponse.body.id;

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
          schemaSnapshot: extractionSchema,
          actionId: action.id,
        })
        .expect(201);

      // Verify user was updated correctly
      const updatedUser = await userRepo.findOne({
        where: { id: ctx.testUserId },
      });

      // Verify extracted fields were saved
      expect(updatedUser?.phoneNumber).toBe('+14155551234');
      expect(updatedUser?.phoneNumberValidated).toBe(true);
      expect(updatedUser?.timeZone).toBe('America/New_York');
      expect(updatedUser?.customCityString).toBe('Custom City Name');
      expect(updatedUser?.shareInfoPublicly).toBe(true);
      expect(updatedUser?.profileDescription).toBe(initialDescription);
    });

    it('extracts preferredReminderTime from time field', async () => {
      const initialDescription = 'Another description that should persist';
      await userRepo.update(ctx.testUserId, {
        profileDescription: initialDescription,
        preferredReminderTime: null as unknown as string,
      });

      const timeSchema: FormSchema = {
        title: 'Time Extraction Form',
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'time-field',
                kind: 'time',
                label: 'Preferred Reminder Time',
                autoExtractUserData: true,
              },
            ],
          },
        ],
        outputViews: [],
      };

      const action = await createAction('Time Extraction Action');
      const formResponse = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: timeSchema.title, schema: timeSchema })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formResponse.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            'time-field': '09:30',
          },
          schemaSnapshot: timeSchema,
          actionId: action.id,
        })
        .expect(201);

      const updatedUser = await userRepo.findOne({
        where: { id: ctx.testUserId },
      });

      expect(updatedUser?.preferredReminderTime).toBeDefined();
      expect(updatedUser?.profileDescription).toBe(initialDescription);
    });

    it('does not update user fields when form has no auto-extract fields', async () => {
      const initialDescription = 'Description that must not change';
      const initialPhone = '+14155559999';
      await userRepo.update(ctx.testUserId, {
        profileDescription: initialDescription,
        phoneNumber: initialPhone,
        phoneNumberValidated: true,
        shareInfoPublicly: true,
      });

      const noExtractSchema: FormSchema = {
        title: 'No Extraction Form',
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'regular-text',
                kind: 'text',
                label: 'Regular Text Field',
              },
              {
                id: 'regular-checkbox',
                kind: 'checkbox',
                label: 'Regular Checkbox',
              },
            ],
          },
        ],
        outputViews: [],
      };

      const action = await createAction('No Extraction Action');
      const formResponse = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: noExtractSchema.title, schema: noExtractSchema })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formResponse.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            'regular-text': 'Some text',
            'regular-checkbox': false,
          },
          schemaSnapshot: noExtractSchema,
          actionId: action.id,
        })
        .expect(201);

      const updatedUser = await userRepo.findOne({
        where: { id: ctx.testUserId },
      });

      // All user fields should remain unchanged
      expect(updatedUser?.profileDescription).toBe(initialDescription);
      expect(updatedUser?.phoneNumber).toBe(initialPhone);
      expect(updatedUser?.phoneNumberValidated).toBe(true);
      expect(updatedUser?.shareInfoPublicly).toBe(true);
    });

    it('handles invalid phone numbers without setting phoneNumberValidated', async () => {
      await userRepo.update(ctx.testUserId, {
        phoneNumber: null as unknown as string,
        phoneNumberValidated: false,
      });

      const phoneSchema: FormSchema = {
        title: 'Invalid Phone Form',
        pages: [
          {
            id: 'page-1',
            fields: [
              {
                id: 'phone-field',
                kind: 'phone',
                label: 'Phone',
                autoExtractUserData: true,
              },
            ],
          },
        ],
        outputViews: [],
      };

      const action = await createAction('Invalid Phone Action');
      const formResponse = await request(ctx.app.getHttpServer())
        .post('/tasks/createForm')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ title: phoneSchema.title, schema: phoneSchema })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post(`/tasks/submitForm/${formResponse.body.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({
          answers: {
            'phone-field': 'not-a-valid-phone',
          },
          schemaSnapshot: phoneSchema,
          actionId: action.id,
        })
        .expect(201);

      const updatedUser = await userRepo.findOne({
        where: { id: ctx.testUserId },
      });

      // Phone should be saved but not validated
      expect(updatedUser?.phoneNumber).toBe('not-a-valid-phone');
      expect(updatedUser?.phoneNumberValidated).toBe(false);
    });
  });
});
