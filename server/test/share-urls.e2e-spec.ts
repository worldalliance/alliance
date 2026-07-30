import request from 'supertest';
import type { Repository } from 'typeorm';
import {
  ActionEvent,
  ActionStatus,
} from '../src/actions/entities/action-event.entity';
import { Action, VisibilityMode } from '../src/actions/entities/action.entity';
import { Campaign } from '../src/campaign/entities/campaign.entity';
import { Community } from '../src/community/entities/community.entity';
import { ExternalShareTarget } from '../src/share-urls/entities/external-share-target.entity';
import {
  ShareUrl,
  ShareUrlKind,
} from '../src/share-urls/entities/share-url.entity';
import { ShareUrlsService } from '../src/share-urls/share-urls.service';
import { StoredInviteAssignmentKind } from '../src/share-urls/invite-assignment';
import { ReferralSource, User } from '../src/user/entities/user.entity';
import { createTestApp, TestContext } from './e2e-test-utils';

describe('Share URLs (e2e)', () => {
  let ctx: TestContext;
  let actionRepo: Repository<Action>;
  let eventRepo: Repository<ActionEvent>;
  let targetRepo: Repository<ExternalShareTarget>;
  let shareUrlRepo: Repository<ShareUrl>;
  let campaignRepo: Repository<Campaign>;
  let communityRepo: Repository<Community>;
  let userRepo: Repository<User>;
  let shareUrlsService: ShareUrlsService;
  let action: Action;
  let target: ExternalShareTarget;

  beforeAll(async () => {
    ctx = await createTestApp([]);
    actionRepo = ctx.dataSource.getRepository(Action);
    eventRepo = ctx.dataSource.getRepository(ActionEvent);
    targetRepo = ctx.dataSource.getRepository(ExternalShareTarget);
    shareUrlRepo = ctx.dataSource.getRepository(ShareUrl);
    campaignRepo = ctx.dataSource.getRepository(Campaign);
    communityRepo = ctx.dataSource.getRepository(Community);
    userRepo = ctx.dataSource.getRepository(User);
    shareUrlsService = ctx.app.get(ShareUrlsService);

    action = await actionRepo.save(
      actionRepo.create({
        name: 'Share URL Test Action',
        category: 'Test',
        body: 'body',
        taskContents: 'task',
        shortDescription: 'short',
        visibilityMode: VisibilityMode.Public,
        cohortExpression: { type: 'Tag', tagId: ctx.defaultTag.id },
      }),
    );
    await eventRepo.save(
      eventRepo.create({
        title: 'launch',
        description: 'live',
        newStatus: ActionStatus.MemberAction,
        date: new Date(Date.now() - 1000),
        action,
      }),
    );
  }, 50000);

  beforeEach(async () => {
    await shareUrlRepo.query('DELETE FROM share_url');
    await targetRepo.query('DELETE FROM external_share_target');
    await campaignRepo.query('DELETE FROM campaign');
    target = await targetRepo.save(
      targetRepo.create({
        name: 'Test target',
        url: 'https://example.com/route',
        paramName: 'code',
      }),
    );
  });

  describe('GET /share-urls/mine/invites', () => {
    it('returns the number of accounts created with each invite link', async () => {
      const canonical = await shareUrlsService.getOrCreateForInvite({
        type: 'user',
        userId: ctx.testUserId,
      });
      const duplicate = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Unused duplicate',
        null,
      );
      await userRepo.save(
        userRepo.create({
          name: 'Reusable Invite Recruit',
          email: 'reusable-invite-count@example.com',
          password: 'pass',
          referralSource: ReferralSource.InviteShareLink,
          referredByShareUrl: canonical,
        }),
      );

      const res = await request(ctx.app.getHttpServer())
        .get('/share-urls/mine/invites')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      expect(
        res.body.find((row: { id: string }) => row.id === canonical.id)
          ?.signupCount,
      ).toBe(1);
      expect(
        res.body.find((row: { id: string }) => row.id === duplicate.id)
          ?.signupCount,
      ).toBe(0);
    });
  });

  describe('POST /share-urls/mine/invite-duplicate', () => {
    it('stores a selected community led by the inviter', async () => {
      const inviter = await userRepo.findOneByOrFail({ id: ctx.testUserId });
      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Reusable Invite Destination',
          description: 'Selected reusable invite destination',
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );

      const res = await request(ctx.app.getHttpServer())
        .post('/share-urls/mine/invite-duplicate')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ label: 'Group invite', communityId: community.id })
        .expect(201);

      expect(res.body.assignmentKind).toBe('community');
      expect(res.body.communityId).toBe(community.id);
      expect(res.body.communityName).toBe(community.name);
      const stored = await shareUrlRepo.findOneByOrFail({ id: res.body.id });
      expect(stored.inviteAssignmentKind).toBe('community');
      expect(stored.inviteAssignmentCommunityId).toBe(community.id);
    });

    it('reports a destination group that has since been deleted', async () => {
      const inviter = await userRepo.findOneByOrFail({ id: ctx.testUserId });
      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Doomed Reusable Destination',
          description: 'Deleted after the invite link was made',
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Doomed group invite',
        community.id,
      );

      await communityRepo.delete(community.id);

      const res = await request(ctx.app.getHttpServer())
        .get('/share-urls/mine/invites')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(200);

      const row = res.body.find((r: { id: string }) => r.id === invite.id);
      // Deleting the group nulls the id through the FK, leaving a link that
      // still names a destination but no longer has one.
      expect(row?.assignmentKind).toBe('community');
      expect(row?.communityId).toBeNull();
      expect(row?.communityName).toBeNull();
      const stored = await shareUrlRepo.findOneByOrFail({ id: invite.id });
      expect(stored.inviteAssignmentKind).toBe('community');
      expect(stored.inviteAssignmentCommunityId).toBeNull();
    });

    it('cannot store a community id without a community assignment', async () => {
      const inviter = await userRepo.findOneByOrFail({ id: ctx.testUserId });
      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Constraint Check Group',
          description: 'Never actually assigned',
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Open invite',
        null,
      );

      await expect(
        shareUrlRepo.update(invite.id, {
          inviteAssignmentCommunityId: community.id,
        }),
      ).rejects.toThrow(/CHK_share_url_invite_assignment/);
    });

    it('rejects a community the inviter does not lead', async () => {
      const admin = await userRepo.findOneByOrFail({ id: ctx.adminUserId });
      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Other Leader Reusable Destination',
          description: 'Not led by the inviter',
          leaders: [admin],
          users: [admin],
          maxCapacity: 10,
        }),
      );

      await request(ctx.app.getHttpServer())
        .post('/share-urls/mine/invite-duplicate')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ label: 'Invalid group invite', communityId: community.id })
        .expect(400);
    });
  });

  describe('PATCH /share-urls/mine/invites/:id', () => {
    const patch = (id: string, body: Record<string, unknown>) =>
      request(ctx.app.getHttpServer())
        .patch(`/share-urls/mine/invites/${id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send(body);

    const ledCommunity = async (name: string) => {
      const inviter = await userRepo.findOneByOrFail({ id: ctx.testUserId });
      return communityRepo.save(
        communityRepo.create({
          name,
          description: `${name} description`,
          leaders: [inviter],
          users: [inviter],
          maxCapacity: 10,
        }),
      );
    };

    it('retargets an invite at another group the owner leads', async () => {
      const first = await ledCommunity('Retarget Origin');
      const second = await ledCommunity('Retarget Destination');
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Retargeted invite',
        first.id,
      );

      const res = await patch(invite.id, { communityId: second.id }).expect(
        200,
      );

      expect(res.body.assignmentKind).toBe('community');
      expect(res.body.communityId).toBe(second.id);
      expect(res.body.communityName).toBe(second.name);
      // Untouched, since the request did not mention it.
      expect(res.body.label).toBe('Retargeted invite');
    });

    it('points an invite at any open group', async () => {
      const community = await ledCommunity('Open Retarget Origin');
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Open retarget',
        community.id,
      );

      const res = await patch(invite.id, { communityId: null }).expect(200);

      expect(res.body.assignmentKind).toBe('open');
      expect(res.body.communityId).toBeNull();
    });

    it('renames without disturbing the destination', async () => {
      const community = await ledCommunity('Rename Destination');
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Before',
        community.id,
      );

      const res = await patch(invite.id, { label: '  After  ' }).expect(200);

      expect(res.body.label).toBe('After');
      expect(res.body.assignmentKind).toBe('community');
      expect(res.body.communityId).toBe(community.id);
    });

    it('clears the label when sent an empty one', async () => {
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Labelled',
        null,
      );

      const res = await patch(invite.id, { label: '' }).expect(200);

      expect(res.body.label).toBeNull();
    });

    it('rejects a null label rather than choking on it', async () => {
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Labelled',
        null,
      );

      await patch(invite.id, { label: null }).expect(400);
    });

    it('refuses a group the owner does not lead', async () => {
      const admin = await userRepo.findOneByOrFail({ id: ctx.adminUserId });
      const community = await communityRepo.save(
        communityRepo.create({
          name: 'Retarget Not Led',
          description: 'Led by someone else',
          leaders: [admin],
          users: [admin],
          maxCapacity: 10,
        }),
      );
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Unretargetable',
        null,
      );

      await patch(invite.id, { communityId: community.id }).expect(400);

      const stored = await shareUrlRepo.findOneByOrFail({ id: invite.id });
      expect(stored.inviteAssignmentKind).toBe('open');
      expect(stored.inviteAssignmentCommunityId).toBeNull();
    });

    it("refuses to edit someone else's invite", async () => {
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.adminUserId,
        "Admin's invite",
        null,
      );

      await patch(invite.id, { label: 'Hijacked' }).expect(404);
    });

    it('leaves people who already signed up where the link sent them', async () => {
      const original = await ledCommunity('Snapshot Origin');
      const retargeted = await ledCommunity('Snapshot Destination');
      const invite = await shareUrlsService.createDuplicateInviteForUser(
        ctx.testUserId,
        'Snapshot invite',
        original.id,
      );
      const recruit = await userRepo.save(
        userRepo.create({
          name: 'Snapshot Recruit',
          email: 'snapshot.recruit@example.com',
          password: 'Password123!',
          referralSource: ReferralSource.InviteShareLink,
          referredByShareUrl: invite,
          inviteAssignmentKind: StoredInviteAssignmentKind.Community,
          inviteAssignmentCommunityId: original.id,
        }),
      );

      await patch(invite.id, { communityId: retargeted.id }).expect(200);

      const stored = await userRepo.findOneByOrFail({ id: recruit.id });
      expect(stored.inviteAssignmentCommunityId).toBe(original.id);
    });
  });

  describe('POST /share-urls/get-share-link', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .send({ actionId: action.id })
        .expect(401);
    });

    it('returns a URL containing the action route + sid', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ actionId: action.id })
        .expect(201);

      expect(res.body.url).toMatch(
        new RegExp(`/actions/${action.id}\\?sid=share-[a-f0-9]{10}$`),
      );
    });

    it('returns the external target URL with paramName=sid appended', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ externalTargetId: target.id })
        .expect(201);

      expect(res.body.url).toMatch(
        /^https:\/\/example\.com\/route\?code=share-[a-f0-9]{10}$/,
      );
    });

    it('returns the signup URL with ref=sid for an invite', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ invite: true })
        .expect(201);

      expect(res.body.url).toMatch(/\/signup\?ref=share-[a-f0-9]{10}$/);
    });

    it('returns 400 when invite is combined with a target', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ invite: true, actionId: action.id })
        .expect(400);
    });

    it('uses & when the target URL already has a query string', async () => {
      const t = await targetRepo.save(
        targetRepo.create({
          name: 'Pre-query target',
          url: 'https://example.com/route?existing=1',
          paramName: 'code',
        }),
      );
      const res = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ externalTargetId: t.id })
        .expect(201);

      expect(res.body.url).toMatch(
        /^https:\/\/example\.com\/route\?existing=1&code=share-[a-f0-9]{10}$/,
      );
    });

    it('URL-encodes special characters in paramName', async () => {
      const t = await targetRepo.save(
        targetRepo.create({
          name: 'Funky param',
          url: 'https://example.com/route',
          paramName: 'my code',
        }),
      );
      const res = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ externalTargetId: t.id })
        .expect(201);

      expect(res.body.url).toMatch(
        /^https:\/\/example\.com\/route\?my\+code=share-[a-f0-9]{10}$/,
      );
    });

    it('returns 400 when neither actionId nor externalTargetId is set', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({})
        .expect(400);
    });

    it('returns 400 when both actionId and externalTargetId are set', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ actionId: action.id, externalTargetId: target.id })
        .expect(400);
    });

    it('returns 404 for a non-existent actionId', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ actionId: 999999 })
        .expect(404);
    });

    it('returns 404 for a non-existent externalTargetId', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ externalTargetId: 999999 })
        .expect(404);
    });
  });

  describe('dedupe / idempotence', () => {
    const fetchUrl = async (
      token: string,
      body: { actionId?: number; externalTargetId?: number; invite?: boolean },
    ) => {
      const res = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
        .expect(201);
      return res.body.url as string;
    };

    const sidOf = (url: string): string => {
      const match = /share-[a-f0-9]{10}/.exec(url);
      if (!match) throw new Error(`No sid in url: ${url}`);
      return match[0];
    };

    it('same (user, action) returns same sid across calls', async () => {
      const a = await fetchUrl(ctx.accessToken, { actionId: action.id });
      const b = await fetchUrl(ctx.accessToken, { actionId: action.id });
      expect(sidOf(a)).toBe(sidOf(b));
      const rows = await shareUrlRepo.find({
        where: { user: { id: ctx.testUserId }, action: { id: action.id } },
      });
      expect(rows.length).toBe(1);
    });

    it('same (user, externalTarget) returns same sid across calls', async () => {
      const a = await fetchUrl(ctx.accessToken, {
        externalTargetId: target.id,
      });
      const b = await fetchUrl(ctx.accessToken, {
        externalTargetId: target.id,
      });
      expect(sidOf(a)).toBe(sidOf(b));
      const rows = await shareUrlRepo.find({
        where: {
          user: { id: ctx.testUserId },
          externalTarget: { id: target.id },
        },
      });
      expect(rows.length).toBe(1);
    });

    it('same user invite returns same sid across calls', async () => {
      const a = await fetchUrl(ctx.accessToken, { invite: true });
      const b = await fetchUrl(ctx.accessToken, { invite: true });
      expect(sidOf(a)).toBe(sidOf(b));
      const rows = await shareUrlRepo.find({
        where: { user: { id: ctx.testUserId }, kind: ShareUrlKind.Invite },
      });
      expect(rows.length).toBe(1);
    });

    it('invite and action share for one user do not collapse', async () => {
      const a = await fetchUrl(ctx.accessToken, { invite: true });
      const b = await fetchUrl(ctx.accessToken, { actionId: action.id });
      expect(sidOf(a)).not.toBe(sidOf(b));
    });

    it('same campaign invite returns same sid across calls', async () => {
      const campaign = await campaignRepo.save(
        campaignRepo.create({ name: 'Promo', code: 'promo-invite' }),
      );
      const owner = { type: 'campaign', campaignId: campaign.id } as const;
      const a = await shareUrlsService.getOrCreateForInvite(owner);
      const b = await shareUrlsService.getOrCreateForInvite(owner);
      expect(sidOf(a.url)).toBe(sidOf(b.url));
      const rows = await shareUrlRepo.find({
        where: { campaign: { id: campaign.id }, kind: ShareUrlKind.Invite },
      });
      expect(rows.length).toBe(1);
    });

    it('different external targets give the same user distinct sids', async () => {
      const other = await targetRepo.save(
        targetRepo.create({
          name: 'Other',
          url: 'https://example.com/other',
          paramName: 'ref',
        }),
      );
      const a = await fetchUrl(ctx.accessToken, {
        externalTargetId: target.id,
      });
      const b = await fetchUrl(ctx.accessToken, { externalTargetId: other.id });
      expect(sidOf(a)).not.toBe(sidOf(b));
    });

    it('different users get distinct sids for the same external target', async () => {
      const a = await fetchUrl(ctx.accessToken, {
        externalTargetId: target.id,
      });
      const b = await fetchUrl(ctx.adminAccessToken, {
        externalTargetId: target.id,
      });
      expect(sidOf(a)).not.toBe(sidOf(b));
    });

    it('action share and external-target share for one user do not collapse', async () => {
      const a = await fetchUrl(ctx.accessToken, { actionId: action.id });
      const b = await fetchUrl(ctx.accessToken, {
        externalTargetId: target.id,
      });
      expect(sidOf(a)).not.toBe(sidOf(b));
      const rows = await shareUrlRepo.find({
        where: { user: { id: ctx.testUserId } },
      });
      expect(rows.length).toBe(2);
    });
  });

  describe('POST /share-urls/create-duplicate', () => {
    const sidOf = (url: string): string => {
      const match = /share-[a-f0-9]{10}/.exec(url);
      if (!match) throw new Error(`No sid in url: ${url}`);
      return match[0];
    };

    it('returns 401 without auth', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .send({ userId: ctx.testUserId, actionId: action.id })
        .expect(401);
    });

    it('returns 401 for non-admin', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ userId: ctx.testUserId, actionId: action.id })
        .expect(401);
    });

    it('admin creates an action duplicate with a fresh sid and label', async () => {
      const first = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ actionId: action.id })
        .expect(201);

      const dup = await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, actionId: action.id, label: 'Alice' })
        .expect(201);

      expect(sidOf(dup.body.url)).not.toBe(sidOf(first.body.url));
      expect(dup.body.url).toMatch(
        new RegExp(`/actions/${action.id}\\?sid=share-[a-f0-9]{10}$`),
      );
      expect(dup.body.duplicate).toBe(true);
      expect(dup.body.label).toBe('Alice');
      expect(dup.body.action?.id).toBe(action.id);

      const rows = await shareUrlRepo.find({
        where: { user: { id: ctx.testUserId }, action: { id: action.id } },
      });
      expect(rows.length).toBe(2);
      expect(rows.filter((r) => r.duplicate).length).toBe(1);
    });

    it('admin creates an invite duplicate with a fresh sid and label', async () => {
      const canonical = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ invite: true })
        .expect(201);

      const dup = await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, invite: true, label: 'Bob' })
        .expect(201);

      expect(sidOf(dup.body.url)).not.toBe(sidOf(canonical.body.url));
      expect(dup.body.url).toMatch(/\/signup\?ref=share-[a-f0-9]{10}$/);
      expect(dup.body.kind).toBe(ShareUrlKind.Invite);
      expect(dup.body.duplicate).toBe(true);
      expect(dup.body.label).toBe('Bob');
      expect(dup.body.action).toBeNull();
      expect(dup.body.externalTarget).toBeNull();

      const rows = await shareUrlRepo.find({
        where: { user: { id: ctx.testUserId }, kind: ShareUrlKind.Invite },
      });
      expect(rows.length).toBe(2);
      expect(rows.filter((r) => r.duplicate).length).toBe(1);
    });

    it('admin creates a campaign invite duplicate alongside the canonical', async () => {
      const campaign = await campaignRepo.save(
        campaignRepo.create({ name: 'Promo', code: 'promo-dup' }),
      );
      const canonical = await shareUrlsService.getOrCreateForInvite({
        type: 'campaign',
        campaignId: campaign.id,
      });

      const dup = await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ campaignId: campaign.id, invite: true, label: 'Booth' })
        .expect(201);

      expect(sidOf(dup.body.url)).not.toBe(sidOf(canonical.url));
      expect(dup.body.url).toMatch(/\/signup\?ref=share-[a-f0-9]{10}$/);
      expect(dup.body.kind).toBe(ShareUrlKind.Invite);
      expect(dup.body.duplicate).toBe(true);
      expect(dup.body.label).toBe('Booth');
      expect(dup.body.campaignId).toBe(campaign.id);

      const rows = await shareUrlRepo.find({
        where: { campaign: { id: campaign.id }, kind: ShareUrlKind.Invite },
      });
      expect(rows.length).toBe(2);
      expect(rows.filter((r) => r.duplicate).length).toBe(1);
    });

    it('omits label when not provided (stored as null)', async () => {
      const dup = await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, actionId: action.id })
        .expect(201);
      expect(dup.body.label).toBeNull();
    });

    it('whitespace-only label is stored as null', async () => {
      const dup = await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, actionId: action.id, label: '   ' })
        .expect(201);
      expect(dup.body.label).toBeNull();
    });

    it('admin creates an external-target duplicate with a fresh sid', async () => {
      const first = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ externalTargetId: target.id })
        .expect(201);

      const dup = await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, externalTargetId: target.id })
        .expect(201);

      expect(sidOf(dup.body.url)).not.toBe(sidOf(first.body.url));
      expect(dup.body.url).toMatch(
        /^https:\/\/example\.com\/route\?code=share-[a-f0-9]{10}$/,
      );
    });

    it('two duplicates for the same (user, action) get distinct sids', async () => {
      const a = await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, actionId: action.id })
        .expect(201);
      const b = await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, actionId: action.id })
        .expect(201);
      expect(sidOf(a.body.url)).not.toBe(sidOf(b.body.url));
    });

    it('get-share-link still returns the canonical sid after duplicates exist', async () => {
      const canonical = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ actionId: action.id })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, actionId: action.id })
        .expect(201);

      const again = await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ actionId: action.id })
        .expect(201);

      expect(sidOf(again.body.url)).toBe(sidOf(canonical.body.url));
    });

    it('returns 400 when neither actionId nor externalTargetId is set', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId })
        .expect(400);
    });

    it('returns 400 when both actionId and externalTargetId are set', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          userId: ctx.testUserId,
          actionId: action.id,
          externalTargetId: target.id,
        })
        .expect(400);
    });

    it('returns 404 for a non-existent actionId', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, actionId: 999999 })
        .expect(404);
    });

    it('returns 404 for a non-existent externalTargetId', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, externalTargetId: 999999 })
        .expect(404);
    });
  });

  describe('GET /share-urls/for-user/:userId', () => {
    it('returns 401 without auth', async () => {
      await request(ctx.app.getHttpServer())
        .get(`/share-urls/for-user/${ctx.testUserId}`)
        .expect(401);
    });

    it('returns 401 for non-admin', async () => {
      await request(ctx.app.getHttpServer())
        .get(`/share-urls/for-user/${ctx.testUserId}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it('returns an empty list when the user has no share urls', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/share-urls/for-user/${ctx.testUserId}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('returns canonical + duplicate rows with joined targets and labels', async () => {
      await request(ctx.app.getHttpServer())
        .post('/share-urls/get-share-link')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ actionId: action.id })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, actionId: action.id, label: 'Bob' })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          userId: ctx.testUserId,
          externalTargetId: target.id,
          label: 'Carol',
        })
        .expect(201);

      const res = await request(ctx.app.getHttpServer())
        .get(`/share-urls/for-user/${ctx.testUserId}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);

      expect(res.body.length).toBe(3);
      const canonicalAction = res.body.find(
        (r: { duplicate: boolean; action: { id: number } | null }) =>
          !r.duplicate && r.action?.id === action.id,
      );
      const dupAction = res.body.find(
        (r: {
          duplicate: boolean;
          label: string | null;
          action: { id: number } | null;
        }) => r.duplicate && r.action?.id === action.id && r.label === 'Bob',
      );
      const dupExternal = res.body.find(
        (r: {
          duplicate: boolean;
          label: string | null;
          externalTarget: { id: number } | null;
        }) =>
          r.duplicate &&
          r.externalTarget?.id === target.id &&
          r.label === 'Carol',
      );

      expect(canonicalAction).toBeDefined();
      expect(canonicalAction.action.name).toBe(action.name);
      expect(canonicalAction.label).toBeNull();
      expect(dupAction).toBeDefined();
      expect(dupExternal).toBeDefined();
      expect(dupExternal.externalTarget.name).toBe(target.name);
    });
  });

  describe('PATCH /share-urls/:id/label', () => {
    const createDuplicateWithLabel = async (label: string): Promise<string> => {
      const res = await request(ctx.app.getHttpServer())
        .post('/share-urls/create-duplicate')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ userId: ctx.testUserId, actionId: action.id, label })
        .expect(201);
      return res.body.id as string;
    };

    it('returns 401 without auth', async () => {
      const id = await createDuplicateWithLabel('orig');
      await request(ctx.app.getHttpServer())
        .patch(`/share-urls/${id}/label`)
        .send({ label: 'new' })
        .expect(401);
    });

    it('returns 401 for non-admin', async () => {
      const id = await createDuplicateWithLabel('orig');
      await request(ctx.app.getHttpServer())
        .patch(`/share-urls/${id}/label`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ label: 'new' })
        .expect(401);
    });

    it('updates the label and returns the updated row', async () => {
      const id = await createDuplicateWithLabel('orig');
      const res = await request(ctx.app.getHttpServer())
        .patch(`/share-urls/${id}/label`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ label: 'Alice' })
        .expect(200);
      expect(res.body.id).toBe(id);
      expect(res.body.label).toBe('Alice');

      const row = await shareUrlRepo.findOne({ where: { id } });
      expect(row?.label).toBe('Alice');
    });

    it('clears the label when sent an empty string', async () => {
      const id = await createDuplicateWithLabel('orig');
      const res = await request(ctx.app.getHttpServer())
        .patch(`/share-urls/${id}/label`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ label: '' })
        .expect(200);
      expect(res.body.label).toBeNull();
    });

    it('whitespace-only label clears it', async () => {
      const id = await createDuplicateWithLabel('orig');
      const res = await request(ctx.app.getHttpServer())
        .patch(`/share-urls/${id}/label`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ label: '   ' })
        .expect(200);
      expect(res.body.label).toBeNull();
    });

    it('returns 404 for an unknown id', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/share-urls/00000000-0000-0000-0000-000000000000/label')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ label: 'whatever' })
        .expect(404);
    });
  });

  describe('admin CRUD: /external-share-targets', () => {
    it('GET (admin) returns the list', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/external-share-targets')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(
        res.body.find((t: { id: number }) => t.id === target.id),
      ).toBeDefined();
    });

    it('GET rejects non-admin', async () => {
      await request(ctx.app.getHttpServer())
        .get('/external-share-targets')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it('GET requires auth (401 anon)', async () => {
      await request(ctx.app.getHttpServer())
        .get('/external-share-targets')
        .expect(401);
    });

    it('GET /:id returns one (admin)', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/external-share-targets/${target.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      expect(res.body.id).toBe(target.id);
      expect(res.body.name).toBe(target.name);
    });

    it('GET /:id rejects non-admin', async () => {
      await request(ctx.app.getHttpServer())
        .get(`/external-share-targets/${target.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it('POST creates as admin', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/external-share-targets')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({
          name: 'Brand new',
          url: 'https://example.com/new',
          paramName: 'r',
        })
        .expect(201);
      expect(res.body.id).toBeGreaterThan(0);
      expect(res.body.name).toBe('Brand new');
      expect(res.body.paramName).toBe('r');
    });

    it('POST rejects non-admin', async () => {
      await request(ctx.app.getHttpServer())
        .post('/external-share-targets')
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ name: 'x', url: 'https://example.com', paramName: 'r' })
        .expect(401);
    });

    it('PATCH updates as admin', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/external-share-targets/${target.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .send({ name: 'Renamed' })
        .expect(200);
      expect(res.body.name).toBe('Renamed');
      expect(res.body.url).toBe(target.url);
    });

    it('PATCH rejects non-admin', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/external-share-targets/${target.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .send({ name: 'Should not apply' })
        .expect(401);
    });

    it('DELETE removes as admin', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/external-share-targets/${target.id}`)
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(200);
      const remaining = await targetRepo.findOne({ where: { id: target.id } });
      expect(remaining).toBeNull();
    });

    it('DELETE rejects non-admin', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/external-share-targets/${target.id}`)
        .set('Authorization', `Bearer ${ctx.accessToken}`)
        .expect(401);
    });

    it('DELETE returns 404 for unknown id', async () => {
      await request(ctx.app.getHttpServer())
        .delete('/external-share-targets/999999')
        .set('Authorization', `Bearer ${ctx.adminAccessToken}`)
        .expect(404);
    });
  });
});
