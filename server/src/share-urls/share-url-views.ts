import type { ShareUrl } from "./entities/share-url.entity";
import type { StoredInviteAssignment } from "./invite-assignment";

/**
 * Read models the share-url service hands to its DTOs. They live outside the
 * entity so they can name a parsed {@link StoredInviteAssignment}, which the
 * entity itself cannot import.
 */
export type ShareUrlWithSignupCount = {
  shareUrl: ShareUrl;
  signupCount: number;
};

export type ShareUrlMine = ShareUrlWithSignupCount & {
  /** Read off the link's assignment columns once, by the service. */
  assignment: StoredInviteAssignment | null;

  /**
   * Name of the group the invite places people in, for display. Null when it
   * names none and when the group it named was deleted.
   */
  assignmentCommunityName: string | null;
};
