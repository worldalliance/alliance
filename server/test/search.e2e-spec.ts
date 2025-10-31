import { Repository } from 'typeorm';
import * as request from 'supertest';
import { createTestApp, TestContext } from './e2e-test-utils';
import { SearchModule } from 'src/search/search.module';
import { User } from 'src/user/entities/user.entity';
import { Action } from 'src/actions/entities/action.entity';
import {
  ActionEvent,
  ActionStatus,
} from 'src/actions/entities/action-event.entity';
import { Post } from 'src/forum/entities/post.entity';
import { RecentSearch } from 'src/search/recentsearch.entity';
import { SearchItemType } from 'src/search/searchitem.dto';

describe('Search (e2e)', () => {
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
        name: 'Target User',
        email: 'target@example.com',
        password: 'Password123!',
        anonymous: false,
      }),
    );

    targetAction = await actionRepo.save(
      actionRepo.create({
        name: 'Targeted Cleanup Action',
        category: 'Environment',
        body: 'Clean the neighbourhood park',
        shortDescription: 'Cleanup day',
        taskContents: 'Bring gloves',
      }),
    );

    await eventRepo.save(
      eventRepo.create({
        title: 'Launch',
        description: 'Action is live',
        newStatus: ActionStatus.GatheringCommitments,
        date: new Date(Date.now() - 1000),
        showInTimeline: true,
        action: targetAction,
      }),
    );

    targetPost = await postRepo.save(
      postRepo.create({
        title: 'Target Post About Action',
        editableContent: {
          body: 'Join us for the cleanup',
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
    await recentSearchRepo.query('DELETE FROM recent_search');
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('returns matching users, actions, and posts for a search query', async () => {
    const response = await request(ctx.app.getHttpServer())
      .get('/search/all')
      .query({ query: 'Target' })
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    const ids = response.body.map((item) => item.id);
    expect(ids).toContain(`u${targetUser.id}`);
    expect(ids).toContain(`a${targetAction.id}`);
    expect(ids).toContain(`p${targetPost.id}`);
  });

  it('persists and returns recent selections when query is empty', async () => {
    await request(ctx.app.getHttpServer())
      .post('/search/selected')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send({
        id: `a${targetAction.id}`,
        name: targetAction.name,
        webAppLocation: '/actions',
        secondaryData: [],
        type: SearchItemType.Action,
      })
      .expect(201);

    const response = await request(ctx.app.getHttpServer())
      .get('/search/all')
      .query({ query: '' })
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].id).toBe(`a${targetAction.id}`);
  });

  it('deduplicates saved selections when the same item is stored again', async () => {
    const payload = {
      id: `u${targetUser.id}`,
      name: targetUser.name,
      webAppLocation: '/users',
      secondaryData: [],
      type: SearchItemType.User,
    };

    await request(ctx.app.getHttpServer())
      .post('/search/selected')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(payload)
      .expect(201);

    await request(ctx.app.getHttpServer())
      .post('/search/selected')
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .send(payload)
      .expect(201);

    const response = await request(ctx.app.getHttpServer())
      .get('/search/all')
      .query({ query: '' })
      .set('Authorization', `Bearer ${ctx.accessToken}`)
      .expect(200);

    const userItems = response.body.filter(
      (item) => item.id === `u${targetUser.id}`,
    );
    expect(userItems.length).toBe(1);
  });
});
