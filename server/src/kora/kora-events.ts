/** A member finished the Kora assignment they started from a Kora review action. */
export const KORA_ACTION_REVIEWED = "kora.action.reviewed";

export type KoraActionReviewed = { userId: number; actionId: number };
