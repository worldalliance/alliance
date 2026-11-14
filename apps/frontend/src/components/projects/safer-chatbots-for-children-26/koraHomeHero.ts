import { KoraUserBatchStatus } from "@alliance/common/kora";
import type { KoraHomeDto, KoraUserBatchDto } from "@alliance/shared/client";
import { differenceInCalendarDays } from "date-fns";
import { z } from "zod";
import { HOME_COPY } from "./copy";

export enum HeroAction {
  /** Opens the review page on the open user-batch. */
  Continue = "continue",
  /** Creates the offered user-batch, then opens the review page. */
  Start = "start",
}

export type Hero = {
  heading: string;
  action: { kind: HeroAction; label: string } | null;
  note: string | null;
};

const CLOSES_SOON_DAYS = 2;

export const statusOf = (batch: KoraUserBatchDto) =>
  z.enum(KoraUserBatchStatus).parse(batch.status);

export const formatLongDate = (iso: string) =>
  new Intl.DateTimeFormat("en", { month: "long", day: "numeric" }).format(
    new Date(iso),
  );

export const formatShortDate = (iso: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(iso),
  );

function deadline(closesAt: string | null, now: Date): string {
  if (!closesAt) return "";
  const days = differenceInCalendarDays(new Date(closesAt), now);
  const soon =
    days >= 0 && days <= CLOSES_SOON_DAYS
      ? HOME_COPY.closesSoon(
          new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
            days,
            "day",
          ),
        )
      : "";
  return HOME_COPY.by(formatLongDate(closesAt)) + soon;
}

export function heroOf(home: KoraHomeDto, now: Date): Hero {
  const find = (status: KoraUserBatchStatus) =>
    home.userBatches.find((b) => statusOf(b) === status);
  const open = find(KoraUserBatchStatus.Open);
  if (open) {
    const left = open.total - open.progress;
    return {
      heading:
        (open.progress === 0
          ? HOME_COPY.rank(open.total)
          : HOME_COPY.rankMore(left)) + deadline(open.closesAt, now),
      action: {
        kind: HeroAction.Continue,
        label:
          open.progress === 0
            ? HOME_COPY.startRanking
            : HOME_COPY.continueRanking,
      },
      note: null,
    };
  }
  const ready = find(KoraUserBatchStatus.Ready);
  const latest = home.userBatches.find(
    (b) => statusOf(b) !== KoraUserBatchStatus.Ready,
  );
  if (ready && latest && statusOf(latest) === KoraUserBatchStatus.Done) {
    return {
      heading: HOME_COPY.rankedAll(latest.total),
      action: {
        kind: HeroAction.Start,
        label: HOME_COPY.rankAnother(ready.total),
      },
      note: null,
    };
  }
  if (ready) {
    return {
      heading: HOME_COPY.rank(ready.total) + deadline(ready.closesAt, now),
      action: { kind: HeroAction.Start, label: HOME_COPY.startRanking },
      note: null,
    };
  }
  return {
    heading: HOME_COPY.caughtUp,
    action: null,
    note: HOME_COPY.caughtUpNote,
  };
}

/** The table repeats nothing the hero already says. */
export function showBatchTable(home: KoraHomeDto): boolean {
  const [only, ...rest] = home.userBatches;
  if (!only) return false;
  if (rest.length > 0) return true;
  const status = statusOf(only);
  return (
    status !== KoraUserBatchStatus.Open && status !== KoraUserBatchStatus.Ready
  );
}
