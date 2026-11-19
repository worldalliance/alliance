import { KoraUserBatchStatus } from "@alliance/common/kora";

export type KoraSessionProgress = {
  id: string;
  createdAt: Date;
  releasedAt: Date | null;
  closesAt: Date | null;
  endedAt: Date | null;
  total: number;
  /** Done or opted out. */
  progress: number;
  /** Done only. */
  ranked: number;
};

export type KoraOffer = {
  releasedAt: Date;
  closesAt: Date | null;
};

export type KoraUserBatch = {
  /** Null for an offer, which has no session until the participant starts it. */
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
  session: Pick<KoraSessionProgress, "endedAt" | "closesAt">,
  now: Date,
): KoraUserBatchStatus {
  if (session.endedAt) return KoraUserBatchStatus.Done;
  if (session.closesAt && session.closesAt <= now) {
    return KoraUserBatchStatus.Closed;
  }
  return KoraUserBatchStatus.Open;
}

/** The offer shows only while no session is open. */
export function koraHome(params: {
  now: Date;
  sessions: KoraSessionProgress[];
  offer: KoraOffer | null;
}): KoraHome {
  const rows = params.sessions
    .filter((a) => a.total > 0)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(
      (s): KoraUserBatch => ({
        id: s.id,
        status: statusOf(s, params.now),
        releasedAt: s.releasedAt ?? s.createdAt,
        closesAt: s.closesAt,
        progress: s.progress,
        total: s.total,
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
            total: 0,
          },
        ]
      : [];
  return {
    totalRanked: params.sessions.reduce((sum, s) => sum + s.ranked, 0),
    userBatches: [...offer, ...rows],
  };
}
