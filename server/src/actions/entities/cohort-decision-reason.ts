export enum CohortDecisionReason {
  Launch = "launch",
  Signing = "signing",
  /**
   * Processing first reached the member after the member-action deadline, so
   * the decision is an exclusion rather than a fresh missed obligation.
   */
  ResolvedAfterDeadline = "resolved_after_deadline",
  Backfill = "backfill",
  StaffCorrection = "staff_correction",
  /** The member was admissible at launch on an action with prerequisites. */
  PrerequisitesResolved = "prerequisites_resolved",
}
