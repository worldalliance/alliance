export enum JoinPhase {
  Idle = "idle",
  /** The green bar has slid out from under the contract card. */
  Received = "received",
  /** That same green is growing to cover the panel. */
  Flooding = "flooding",
  /** The welcome screen is behind the green, which is fading off it. */
  Settling = "settling",
}

export const JOIN_PHASE_MS: Record<JoinPhase, number> = {
  [JoinPhase.Idle]: 0,
  [JoinPhase.Received]: 900,
  [JoinPhase.Flooding]: 720,
  [JoinPhase.Settling]: 620,
};

export type FloodOrigin = {
  top: number;
  left: number;
  width: number;
  height: number;
};
