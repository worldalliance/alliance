import { run } from "@alliance/common/run";
import { appendQueryParam } from "@alliance/common/url";
import { NotFoundException } from "@nestjs/common";
import { Action } from "src/actions/entities/action.entity";
import { Community } from "src/community/entities/community.entity";
import { assertLive } from "src/datasources/soft-delete";
import {
  generateCIDForExternalTarget,
  generateCIDForShareUrl,
} from "src/notifs/notif-utils";
import { actionUrl, signupUrl, withRef, withSid } from "src/search/approutes";
import {
  type EntityManager,
  type FindOptionsWhere,
  QueryFailedError,
} from "typeorm";
import { ExternalShareTarget } from "./entities/external-share-target.entity";
import { ShareUrl, ShareUrlKind } from "./entities/share-url.entity";
import {
  inviteAssignmentColumns,
  type StoredInviteAssignment,
  StoredInviteAssignmentKind,
} from "./invite-assignment";
import { lockOwner } from "./share-url-locks";
import {
  ownerColumns,
  ownerWhere,
  type ShareUrlOwner,
} from "./share-url-owner";

const NOT_FOUND_MESSAGE: Record<ShareUrlKind, string> = {
  [ShareUrlKind.Action]: "specified action not found",
  [ShareUrlKind.ExternalTarget]: "specified share target not found",
  [ShareUrlKind.Invite]: "invite share link could not be created",
} as const;

const OWNER_NOT_FOUND: Record<ShareUrlOwner["type"], string> = {
  user: "specified user not found",
  campaign: "specified campaign not found",
};

export async function lockExternalTarget(
  manager: EntityManager,
  id: number,
): Promise<ExternalShareTarget> {
  const target = await manager.findOne(ExternalShareTarget, {
    where: { id },
    lock: { mode: "pessimistic_read" },
  });
  if (!target) {
    throw new NotFoundException(NOT_FOUND_MESSAGE[ShareUrlKind.ExternalTarget]);
  }
  return target;
}

type GetOrCreateInput =
  | { kind: ShareUrlKind.Action; actionId: number; owner: ShareUrlOwner }
  | {
      kind: ShareUrlKind.ExternalTarget;
      externalTarget: ExternalShareTarget;
      owner: ShareUrlOwner;
    }
  | {
      kind: ShareUrlKind.Invite;
      owner: ShareUrlOwner;
      inviteAssignment?: StoredInviteAssignment;
    };

type BuildRowInput = GetOrCreateInput & {
  duplicate: boolean;
  label?: string | null;
};

export async function getOrCreateShareUrl(
  manager: EntityManager,
  input: GetOrCreateInput,
): Promise<ShareUrl> {
  const repo = manager.getRepository(ShareUrl);
  const where = run((): FindOptionsWhere<ShareUrl> => {
    switch (input.kind) {
      case ShareUrlKind.Action:
        return {
          ...ownerWhere(input.owner),
          action: { id: input.actionId },
          duplicate: false,
        };
      case ShareUrlKind.ExternalTarget:
        return {
          ...ownerWhere(input.owner),
          externalTarget: { id: input.externalTarget.id },
          duplicate: false,
        };
      case ShareUrlKind.Invite:
        return {
          ...ownerWhere(input.owner),
          kind: ShareUrlKind.Invite,
          duplicate: false,
        };
      default:
        throw new Error(
          `getOrCreateShareUrl: unknown share url kind: ${input satisfies never}`,
        );
    }
  });
  const existing = await repo.findOne({ where });
  if (existing) {
    return existing;
  }

  try {
    return await buildAndSaveShareUrl(manager, {
      ...input,
      duplicate: false,
    });
  } catch (err) {
    if (err instanceof QueryFailedError) {
      const code = (err as { code?: string }).code;
      if (code === "23505") {
        const winner = await repo.findOne({ where });
        if (winner) {
          return winner;
        }
      }
    }
    throw err;
  }
}

export async function buildAndSaveShareUrl(
  manager: EntityManager,
  input: BuildRowInput,
): Promise<ShareUrl> {
  if (!manager.queryRunner?.isTransactionActive) {
    return manager.transaction((m) => buildAndSaveShareUrl(m, input));
  }
  const repo = manager.getRepository(ShareUrl);
  // An account locks before the group its link places members in, a
  // campaign after it: the orders their deletions take them in.
  const ownerFirst = input.owner.type === "user";
  if (ownerFirst && !(await lockOwner(manager, input.owner))) {
    throw new NotFoundException(OWNER_NOT_FOUND[input.owner.type]);
  }
  const built = await run(
    async (): Promise<{
      sid: string;
      url: string;
      action: Action | null;
      externalTarget: ExternalShareTarget | null;
    }> => {
      switch (input.kind) {
        case ShareUrlKind.Action: {
          const action = await manager.findOne(Action, {
            where: { id: input.actionId },
            lock: { mode: "for_key_share" },
          });
          if (!action) {
            throw new NotFoundException(NOT_FOUND_MESSAGE[input.kind]);
          }
          const sid = generateCIDForShareUrl();
          return {
            sid,
            url: withSid(actionUrl(input.actionId, true), sid),
            action,
            externalTarget: null,
          };
        }
        case ShareUrlKind.ExternalTarget: {
          const sid = generateCIDForExternalTarget();
          return {
            sid,
            url: appendQueryParam(
              input.externalTarget.url,
              input.externalTarget.paramName,
              sid,
            ),
            action: null,
            externalTarget: input.externalTarget,
          };
        }
        case ShareUrlKind.Invite: {
          const sid = generateCIDForShareUrl();
          const assignment = input.inviteAssignment;
          if (
            assignment?.kind === StoredInviteAssignmentKind.Community &&
            assignment.communityId !== null
          ) {
            await assertLive(manager, {
              rows: [{ target: Community, id: assignment.communityId }],
              gone: () => new NotFoundException("Community not found"),
            });
          }
          return {
            sid,
            url: withRef(signupUrl(true), sid),
            action: null,
            externalTarget: null,
          };
        }
        default:
          throw new Error(
            `buildAndSaveShareUrl: unknown share url kind: ${input satisfies never}`,
          );
      }
    },
  );

  if (!ownerFirst && !(await lockOwner(manager, input.owner))) {
    throw new NotFoundException(OWNER_NOT_FOUND[input.owner.type]);
  }

  const shareUrl = repo.create({
    url: built.url,
    kind: input.kind,
    ...ownerColumns(input.owner),
    action: built.action,
    externalTarget: built.externalTarget,
    sid: built.sid,
    ...inviteAssignmentColumns(
      input.kind === ShareUrlKind.Invite
        ? (input.inviteAssignment ?? null)
        : null,
    ),
    duplicate: input.duplicate,
    label: input.label ?? null,
  });

  return repo.save(shareUrl);
}
