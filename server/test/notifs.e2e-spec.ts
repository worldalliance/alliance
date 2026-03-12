import { NotifsModule } from 'src/notifs/notifs.module';
import { Comment, CommentParentObject } from 'src/forum/entities/comment.entity';
import { EditableContent } from 'src/forum/entities/editablecontent.entity';
import { User } from 'src/user/entities/user.entity';
import type { Repository } from 'typeorm';
import {
  Notification,
  NotificationCategory,
} from '../src/notifs/entities/notification.entity';
import { NotificationSourceType } from '../src/notifs/dto/notification.dto';
import {
  UnreadContent,
  UnreadContentType,
} from '../src/notifs/entities/unread-content.entity';
import { createTestApp, TestContext } from './e2e-test-utils';
import { Action } from 'src/actions/entities/action.entity';
import {
  ActionUpdate,
  ActionUpdateNotifyType,
} from 'src/actions/entities/action-update.entity';

describe('Notifications (e2e)', () => {
  let ctx: TestContext;
  let notifRepo: Repository<Notification>;
  let unreadContentRepo: Repository<UnreadContent>;
  let editableContentRepo: Repository<EditableContent>;
  let commentRepo: Repository<Comment>;
  let legacyNotifId: number;
  let unreadNotifId: number;
  let unreadCommentId: number;

  beforeAll(async () => {
    ctx = await createTestApp([NotifsModule]);
    notifRepo = ctx.dataSource.getRepository(Notification);
    unreadContentRepo = ctx.dataSource.getRepository(UnreadContent);
    editableContentRepo = ctx.dataSource.getRepository(EditableContent);
    commentRepo = ctx.dataSource.getRepository(Comment);
    const userRepo = ctx.dataSource.getRepository(User);

    const testUser = await userRepo.findOne({
      where: {
        id: ctx.testUserId,
      },
    });

    if (!testUser) {
      throw new Error('Test user not found');
    }

    const testNotif = notifRepo.create({
      user: testUser,
      message: 'Test notification',
      category: NotificationCategory.FriendRequest,
      webAppLocation: 'test',
      mobileAppLocation: 'test',
    });
    await notifRepo.save(testNotif);
    legacyNotifId = testNotif.id;

    const editableContent = editableContentRepo.create({
      body: 'Test unread reply body',
      attachments: [],
    });
    await editableContentRepo.save(editableContent);

    const comment = commentRepo.create({
      author: testUser,
      authorId: testUser.id,
      editableContent,
      parentObjectType: CommentParentObject.Post,
      parentObjectId: 1,
      deleted: false,
      pinned: false,
      likes: [],
      likesCount: 0,
      children: [],
    });
    await commentRepo.save(comment);
    unreadCommentId = comment.id;

    const unreadContent = unreadContentRepo.create({
      user: testUser,
      contentType: UnreadContentType.ForumReply,
      contentId: unreadCommentId,
      sendTime: new Date(),
      shouldPush: false,
    });
    await unreadContentRepo.save(unreadContent);
    unreadNotifId = unreadContent.id;
  }, 50000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('user can list their notifications from both entities', async () => {
    const res = await ctx.agent.get('/notifs').expect(200);
    expect(res.body.length).toBe(2);
    expect(
      res.body.some(
        (notif: { id: number; category: string; sourceType: string }) =>
          notif.id === legacyNotifId &&
          notif.category === 'friend_request' &&
          notif.sourceType === NotificationSourceType.Notification,
      ),
    ).toBe(true);
    expect(
      res.body.some(
        (notif: { id: number; category: string; sourceType: string }) =>
          notif.id === unreadNotifId &&
          notif.category === 'forum_reply' &&
          notif.sourceType === NotificationSourceType.UnreadContent,
      ),
    ).toBe(true);
  });

  it('user can mark legacy notification as read', async () => {
    await ctx.agent
      .post(`/notifs/read/${legacyNotifId}`)
      .query({ sourceType: NotificationSourceType.Notification })
      .expect(201);

    const notifs = await ctx.agent.get('/notifs').expect(200);
    const notif = notifs.body.find(
      (item: { id: number; sourceType: string }) =>
        item.id === legacyNotifId &&
        item.sourceType === NotificationSourceType.Notification,
    );
    expect(notif?.readAt).toBeTruthy();
  });

  it('user can mark unread-content notification as read', async () => {
    await ctx.agent
      .post(`/notifs/read/${unreadNotifId}`)
      .query({ sourceType: NotificationSourceType.UnreadContent })
      .expect(201);

    const notifs = await ctx.agent.get('/notifs').expect(200);
    const notif = notifs.body.find(
      (item: { id: number; sourceType: string }) =>
        item.id === unreadNotifId &&
        item.sourceType === NotificationSourceType.UnreadContent,
    );
    expect(notif?.readAt).toBeTruthy();
  });

  it('user can mark all notifications read', async () => {
    await notifRepo.update(legacyNotifId, { readAt: null as unknown as Date });
    await unreadContentRepo.update(unreadNotifId, {
      readAt: null as unknown as Date,
    });

    await ctx.agent.post('/notifs/read-all').expect(201);

    const notifs = await ctx.agent.get('/notifs').expect(200);
    expect(notifs.body.every((notif: { readAt?: string }) => notif.readAt)).toBe(
      true,
    );
  });

  it('user can mark unread content read by content id', async () => {
    await unreadContentRepo.update(unreadNotifId, {
      readAt: null as unknown as Date,
      contentType: UnreadContentType.ForumReply,
      contentId: unreadCommentId,
      shouldPush: false,
    });

    await ctx.agent
      .post('/notifs/read-content')
      .send({
        contentType: UnreadContentType.ForumReply,
        contentIds: [unreadCommentId],
      })
      .expect(201);

    const updated = await unreadContentRepo.findOneByOrFail({
      id: unreadNotifId,
    });
    expect(updated.readAt).toBeTruthy();
  });

  it('markdown comment preview text is stripped of markdown syntax', async () => {
    const userRepo = ctx.dataSource.getRepository(User);
    const testUser = await userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
    });

    const editableContent = await editableContentRepo.save(
      editableContentRepo.create({
        body: '**bold text** and a [link](https://example.com) with `inline code`',
        attachments: [],
      }),
    );

    const comment = await commentRepo.save(
      commentRepo.create({
        author: testUser,
        authorId: testUser.id,
        editableContent,
        parentObjectType: CommentParentObject.Post,
        parentObjectId: 1,
        deleted: false,
        pinned: false,
        likes: [],
        likesCount: 0,
        children: [],
      }),
    );

    const unreadContent = await unreadContentRepo.save(
      unreadContentRepo.create({
        user: testUser,
        contentType: UnreadContentType.ForumReply,
        contentId: comment.id,
        sendTime: new Date(),
        shouldPush: false,
      }),
    );

    const res = await ctx.agent.get('/notifs').expect(200);
    const notif = res.body.find(
      (n: { id: number; sourceType: string }) =>
        n.id === unreadContent.id &&
        n.sourceType === NotificationSourceType.UnreadContent,
    );

    expect(notif).toBeDefined();
    expect(notif.message).not.toContain('**');
    expect(notif.message).not.toContain('[link]');
    expect(notif.message).not.toContain('(https://');
    expect(notif.message).not.toContain('`');
    expect(notif.message).toContain('bold text');
    expect(notif.message).toContain('link');
    expect(notif.message).toContain('inline code');
  });

  it('markdown action update preview text is stripped of markdown syntax', async () => {
    const userRepo = ctx.dataSource.getRepository(User);
    const actionRepo = ctx.dataSource.getRepository(Action);
    const actionUpdateRepo = ctx.dataSource.getRepository(ActionUpdate);

    const testUser = await userRepo.findOneOrFail({
      where: { id: ctx.testUserId },
    });

    const action = await actionRepo.save(
      actionRepo.create({
        name: 'Markdown Test Action',
        category: 'Test',
        body: 'test body',
      }),
    );

    const content = await editableContentRepo.save(
      editableContentRepo.create({
        body: 'update content',
        attachments: [],
      }),
    );

    const actionUpdate = await actionUpdateRepo.save(
      actionUpdateRepo.create({
        action,
        title: 'Test Update',
        date: new Date(),
        visibleAt: new Date(Date.now() - 1000),
        shortNotifString:
          '## Heading\n\nSome **bold** and *italic* text with a [link](https://example.com)',
        notifyType: ActionUpdateNotifyType.None,
        content,
      }),
    );

    const unreadContent = await unreadContentRepo.save(
      unreadContentRepo.create({
        user: testUser,
        contentType: UnreadContentType.ActionUpdate,
        contentId: actionUpdate.id,
        sendTime: new Date(),
        shouldPush: false,
      }),
    );

    const res = await ctx.agent.get('/notifs').expect(200);
    const notif = res.body.find(
      (n: { id: number; sourceType: string }) =>
        n.id === unreadContent.id &&
        n.sourceType === NotificationSourceType.UnreadContent,
    );

    expect(notif).toBeDefined();
    expect(notif.message).not.toContain('##');
    expect(notif.message).not.toContain('**');
    expect(notif.message).not.toContain('*italic*');
    expect(notif.message).not.toContain('[link]');
    expect(notif.message).not.toContain('(https://');
    expect(notif.message).toContain('Heading');
    expect(notif.message).toContain('bold');
    expect(notif.message).toContain('italic');
    expect(notif.message).toContain('link');
  });
});
