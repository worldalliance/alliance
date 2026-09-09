export enum JoinPhase {
  Idle = "idle",
  /** The green bar has slid out from under the contract card. */
  Received = "received",
  /** The panel is leaving to the left, uncovering the white the tour opens on. */
  Leaving = "leaving",
}

/** Each beat holds only as long as its own animation, so the run stays even. */
export const JOIN_PHASE_MS: Record<JoinPhase, number> = {
  [JoinPhase.Idle]: 0,
  [JoinPhase.Received]: 560,
  [JoinPhase.Leaving]: 380,
};
