import { R } from "@alliance/common/result";

type Turn = {
  turn: number;
  unanswered: number;
  settled: boolean;
  latestRefused: boolean;
};

/** Likes and unlikes in flight per target, until `reset` ends the session.
 * `take` starts a like or unlike of `target`, which shows `shown` while no
 * other is unanswered. `latest` says whether no later one has started since.
 * `answer` takes the state the server applied, or undefined for a refusal,
 * and once every one is answered after the latest was refused, returns the
 * state the server last confirmed to show instead. */
export function likeTurns() {
  const turns = new Map<string, Turn>();
  const take = (target: string, { shown }: { shown: boolean }) => {
    const entry = turns.get(target) ?? {
      turn: 0,
      unanswered: 0,
      settled: shown,
      latestRefused: false,
    };
    if (entry.unanswered === 0) entry.settled = shown;
    entry.turn++;
    entry.unanswered++;
    entry.latestRefused = false;
    turns.set(target, entry);
    const { turn } = entry;
    return {
      latest: () => entry.turn === turn,
      answer: (applied: boolean | undefined): boolean | undefined => {
        entry.unanswered--;
        if (applied === undefined) {
          if (entry.turn === turn) entry.latestRefused = true;
        } else entry.settled = applied;
        if (entry.unanswered > 0 || !entry.latestRefused) return undefined;
        entry.latestRefused = false;
        return entry.settled;
      },
    };
  };
  return { take, reset: () => turns.clear() };
}

type LikeStore<C> = {
  takeTurn: ReturnType<typeof likeTurns>["take"];
  write: (params: {
    session: number;
    change: C;
    confirmation?: Promise<unknown>;
  }) => void;
};

/** Shows the like at once and settles on the server's answer. A refusal
 * rejects. The answer applies only if no later like or unlike of the same
 * target has started since; a refusal of the latest returns the target, once
 * every one is answered, to the state the server last confirmed. `change`
 * must be idempotent, since it replays as a confirmed write. */
export async function sendLike<C, S>(params: {
  store: LikeStore<C>;
  session: number;
  target: string;
  liked: boolean;
  change: (liked: boolean) => C;
  send: (liked: boolean) => Promise<S>;
  confirmed?: (response: S) => C;
}) {
  const { store, session, liked, change } = params;
  const turn = store.takeTurn(params.target, { shown: !liked });
  const request = params.send(liked);
  store.write({ session, change: change(liked), confirmation: request });
  const sent = await R.fromPromise(request);
  const restore = turn.answer(sent.ok ? liked : undefined);
  if (restore !== undefined) store.write({ session, change: change(restore) });
  if (!sent.ok) throw sent.error;
  if (turn.latest() && params.confirmed)
    store.write({ session, change: params.confirmed(sent.value) });
}

type CountKey<T> = {
  [P in keyof T]-?: T[P] extends number | undefined ? P : never;
}[keyof T];

/** Idempotent, so it can replay over a load that already reads it. */
export const withLike = <T extends { likedByMe?: boolean }>(
  item: T,
  { liked, countKey }: { liked: boolean; countKey: CountKey<T> },
): T => {
  if (Boolean(item.likedByMe) === liked) return item;
  const current = item[countKey];
  const count = typeof current === "number" ? current : 0;
  return {
    ...item,
    likedByMe: liked,
    [countKey]: Math.max(0, count + (liked ? 1 : -1)),
  };
};
