/** Twilio's 1,600-character body limit, counted in UTF-16 code units, which
 * approximates Twilio's undocumented count of an emoji as more than one. */
export const STAFF_TEXT_MAX_LENGTH = 1600;

/** How long after a non-member's last inbound text staff may reply. */
export const NON_MEMBER_REPLY_WINDOW_DAYS = 30;

export const THREAD_SEARCH_MAX_LENGTH = 40;

/** The `error` of a refused staff text that the composer acts on.
 * `NumberChanged` comes only from a member's thread, whose number can change. */
export enum StaffTextConflict {
  NewerTexts = "newer_texts",
  NumberChanged = "number_changed",
}
