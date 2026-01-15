import request from 'supertest';
import { Repository } from 'typeorm';
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
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import { CreateActionDto } from 'src/actions/dto/action.dto';

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
  let formId: number;

  beforeAll(async () => {
    ctx = await createTestApp([TasksModule]);
    formRepo = ctx.dataSource.getRepository(Form);
    formResponseRepo = ctx.dataSource.getRepository(FormResponse);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    userRepo = ctx.dataSource.getRepository(User);
    actionActivityRepo = ctx.dataSource.getRepository(ActionActivity);
  }, 50000);

  afterEach(async () => {
    await formResponseRepo.query('DELETE FROM form_response');
    await formRepo.query('DELETE FROM form');
    await actionRepo.query('DELETE FROM action');
    await eventRepo.query('DELETE FROM action_event');
    await actionActivityRepo.query('DELETE FROM action_activity');
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
        everyoneShouldComplete: false,
        shouldCompleteAfterDeadline: false,
        participatingTags: [ctx.defaultTag],
        priority: 0,
        visibilityMode: VisibilityMode.Public,
        preventCompletion: false,
        optional: false,
        useManualCohort: false,
        publicOnly: false,
        latestMemberActionEvent: {
          event: null,
          deadline: null,
        }
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
});
