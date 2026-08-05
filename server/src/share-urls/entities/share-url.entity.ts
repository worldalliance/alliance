import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Action } from 'src/actions/entities/action.entity';
import { Campaign } from 'src/campaign/entities/campaign.entity';
import { Community } from 'src/community/entities/community.entity';
import {
  CreateDateColumnTz,
  UpdateDateColumnTz,
} from 'src/datasources/basecolumns';
import { User } from 'src/user/entities/user.entity';
import { StoredInviteAssignmentKind } from '../invite-assignment-kind';
import type { Relation } from 'src/utils/Repository';
import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExternalShareTarget } from './external-share-target.entity';

export enum ShareUrlKind {
  Action = 'action',
  ExternalTarget = 'externalTarget',
  // Links directly to the signup page
  Invite = 'invite',
}

@Entity()
@Check(
  'CHK_share_url_kind',
  `("kind" = 'action' ` +
    `AND "actionId" IS NOT NULL ` +
    `AND "externalTargetId" IS NULL) ` +
    `OR ("kind" = 'externalTarget' ` +
    `AND "externalTargetId" IS NOT NULL ` +
    `AND "actionId" IS NULL) ` +
    `OR ("kind" = 'invite' ` +
    `AND "actionId" IS NULL ` +
    `AND "externalTargetId" IS NULL)`,
)
@Check(
  'CHK_share_url_owner',
  '("userId" IS NOT NULL AND "campaignId" IS NULL) ' +
    'OR ("userId" IS NULL AND "campaignId" IS NOT NULL)',
)
@Check(
  'CHK_share_url_invite_assignment',
  `("inviteAssignmentKind" IS NULL OR "kind" = 'invite')
   AND ("inviteAssignmentCommunityId" IS NULL
        OR "inviteAssignmentKind" IS NOT DISTINCT FROM 'community')`,
)
@Index('UQ_share_url_user_action', ['user', 'action'], {
  unique: true,
  where: '"actionId" IS NOT NULL AND "duplicate" = false',
})
@Index('UQ_share_url_user_external_target', ['user', 'externalTarget'], {
  unique: true,
  where: '"externalTargetId" IS NOT NULL AND "duplicate" = false',
})
@Index('UQ_share_url_campaign_action', ['campaign', 'action'], {
  unique: true,
  where:
    '"actionId" IS NOT NULL AND "campaignId" IS NOT NULL AND "duplicate" = false',
})
@Index(
  'UQ_share_url_campaign_external_target',
  ['campaign', 'externalTarget'],
  {
    unique: true,
    where:
      '"externalTargetId" IS NOT NULL AND "campaignId" IS NOT NULL AND "duplicate" = false',
  },
)
@Index('UQ_share_url_user_invite', ['user'], {
  unique: true,
  where: `"kind" = 'invite' AND "userId" IS NOT NULL AND "duplicate" = false`,
})
@Index('UQ_share_url_campaign_invite', ['campaign'], {
  unique: true,
  where: `"kind" = 'invite' AND "campaignId" IS NOT NULL AND "duplicate" = false`,
})
export class ShareUrl {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @ApiProperty()
  url: string;

  @Column({ type: 'enum', enum: ShareUrlKind })
  @ApiProperty({
    enum: ShareUrlKind,
    enumName: 'ShareUrlKind',
  })
  kind: ShareUrlKind;

  @Column({ nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'userId' })
  @Type(() => User)
  user?: Relation<User> | null;

  @Column({ nullable: true })
  campaignId: number | null;

  @ManyToOne(() => Campaign, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'campaignId' })
  @Type(() => Campaign)
  campaign?: Relation<Campaign> | null;

  @Column({ nullable: true })
  actionId: number | null;

  @ManyToOne(() => Action, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'actionId' })
  @Type(() => Action)
  action?: Relation<Action> | null;

  @ManyToOne(() => ExternalShareTarget, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'externalTargetId' })
  @Type(() => ExternalShareTarget)
  externalTarget?: Relation<ExternalShareTarget> | null;

  @Column({ nullable: true })
  @ApiPropertyOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  sid?: string;

  @Column({ default: false })
  @ApiProperty({
    description:
      'When true, this row is an additional share URL for the same (user, action) or (user, externalTarget) — only set by the admin "create duplicate share link" endpoint, used to hand out distinct trackable links to different recruits for the same target. Most rows have this set to false.',
  })
  duplicate: boolean;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({
    description: 'Human-readable name, only viewable in the admin panel',
  })
  label: string | null;

  @CreateDateColumnTz()
  createdAt: Date;

  @UpdateDateColumnTz()
  updatedAt: Date;

  /**
   * Where an invite link places the people who sign up through it. Null for a
   * link that names nowhere — including every link made before the owner could
   * choose — which places them by referral default instead.
   */
  @Column({
    type: 'enum',
    enum: StoredInviteAssignmentKind,
    nullable: true,
  })
  inviteAssignmentKind: StoredInviteAssignmentKind | null;

  /**
   * Null for an `open` assignment, and once the target group is deleted — with
   * a `community` kind that pairing means the group this link named is gone,
   * and signups fall through to manual assignment until the owner retargets it.
   */
  @Column({ nullable: true })
  inviteAssignmentCommunityId: number | null;

  @ManyToOne(() => Community, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inviteAssignmentCommunityId' })
  inviteAssignmentCommunity?: Relation<Community> | null;
}
