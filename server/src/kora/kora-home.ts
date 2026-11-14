import { KoraUserBatchStatus } from "@alliance/common/kora";

export type KoraAssignmentProgress = {
  id: string;
  createdAt: Date;
  releasedAt: Date | null;
  closesAt: Date | null;
  completedAt: Date | null;
  total: number;
  /** Done or opted out. */
  progress: number;
  /** Done only. */
  ranked: number;
};

export type KoraOffer = {
  releasedAt: Date;
  closesAt: Date | null;
  size: number;
};

export type KoraUserBatch = {
  /** Null for an offer, which has no assignment until the participant starts it. */
  id: string | null;
  status: KoraUserBatchStatus;
  releasedAt: Date;
  closesAt: Date | null;
  progress: number;
  total: number;
};

export type KoraHome = {
  totalRanked: number;
  /** Newest first. */
  userBatches: KoraUserBatch[];
};

function statusOf(
  assignment: Pick<KoraAssignmentProgress, "completedAt" | "closesAt">,
  now: Date,
): KoraUserBatchStatus {
  if (assignment.completedAt) return KoraUserBatchStatus.Done;
  if (assignment.closesAt && assignment.closesAt <= now) {
    return KoraUserBatchStatus.Closed;
  }
  return KoraUserBatchStatus.Open;
}

/** The offer shows only while no assignment is open. */
export function koraHome(params: {
  now: Date;
  assignments: KoraAssignmentProgress[];
  offer: KoraOffer | null;
}): KoraHome {
  const rows = params.assignments
    .filter((a) => a.total > 0)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(
      (a): KoraUserBatch => ({
        id: a.id,
        status: statusOf(a, params.now),
        releasedAt: a.releasedAt ?? a.createdAt,
        closesAt: a.closesAt,
        progress: a.progress,
        total: a.total,
      }),
    );
  const open = rows.some((r) => r.status === KoraUserBatchStatus.Open);
  const offer: KoraUserBatch[] =
    params.offer && !open
      ? [
          {
            id: null,
            status: KoraUserBatchStatus.Ready,
            releasedAt: params.offer.releasedAt,
            closesAt: params.offer.closesAt,
            progress: 0,
            total: params.offer.size,
          },
        ]
      : [];
  return {
    totalRanked: params.assignments.reduce((sum, a) => sum + a.ranked, 0),
    userBatches: [...offer, ...rows],
  };
}
