import z from 'zod';
import { ShareUrl, ShareUrlKind } from './entities/share-url.entity';

const storedInviteAssignmentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('community'),
    communityId: z.number().int().positive(),
  }),
  z.object({ kind: z.literal('open') }),
]);

export type StoredInviteAssignment = z.infer<
  typeof storedInviteAssignmentSchema
>;

export enum InviteAssignmentKind {
  Automatic = 'automatic',
  Community = 'community',
  Open = 'open',
}

export function getStoredInviteAssignment(
  shareUrl: ShareUrl,
): StoredInviteAssignment | null {
  if (shareUrl.kind !== ShareUrlKind.Invite) return null;
  const parsed = storedInviteAssignmentSchema.safeParse(
    shareUrl.data?.['inviteAssignment'],
  );
  return parsed.success ? parsed.data : null;
}

