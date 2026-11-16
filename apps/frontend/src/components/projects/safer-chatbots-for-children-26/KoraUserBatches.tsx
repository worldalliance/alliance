import { KORA_REVIEW_PATH, KoraUserBatchStatus } from "@alliance/common/kora";
import type { KoraUserBatchDto } from "@alliance/shared/client";
import { Link } from "react-router";
import { HOME_COPY } from "./copy";
import { formatShortDate, statusOf } from "./koraHomeHero";

const STATUS_LABEL: Record<KoraUserBatchStatus, string> = {
  [KoraUserBatchStatus.Ready]: "Ready",
  [KoraUserBatchStatus.Open]: "Open",
  [KoraUserBatchStatus.Done]: "Done",
  [KoraUserBatchStatus.Closed]: "Closed",
};

const ACTION_CLASS = "site-sans inline-flex min-h-6 items-center underline";

function Action({
  batch,
  start,
  starting,
}: {
  batch: KoraUserBatchDto;
  start: () => void;
  starting: boolean;
}) {
  const status = statusOf(batch);
  switch (status) {
    case KoraUserBatchStatus.Ready:
      return (
        <button
          type="button"
          className={ACTION_CLASS}
          disabled={starting}
          onClick={start}
        >
          {HOME_COPY.start}
        </button>
      );
    case KoraUserBatchStatus.Open:
      return (
        <Link to={KORA_REVIEW_PATH} className={ACTION_CLASS}>
          {HOME_COPY.continue}
        </Link>
      );
    case KoraUserBatchStatus.Done:
    case KoraUserBatchStatus.Closed:
      return null;
    default:
      throw new Error(`unknown status: ${status satisfies never}`);
  }
}

const cells = (batch: KoraUserBatchDto) => ({
  released: formatShortDate(batch.releasedAt),
  closes: batch.closesAt
    ? formatShortDate(batch.closesAt)
    : HOME_COPY.noClosingDate,
  ranked: HOME_COPY.progress(batch.progress, batch.total),
  status: STATUS_LABEL[statusOf(batch)],
});

const rowKey = (batch: KoraUserBatchDto) => batch.id ?? "offer";

/** A table from `sm` up, and one card per user-batch below it, where four columns don't fit. */
export function KoraUserBatches({
  batches,
  start,
  starting,
}: {
  batches: KoraUserBatchDto[];
  start: () => void;
  starting: boolean;
}) {
  return (
    <section aria-labelledby="kora-batches" className="flex flex-col gap-4">
      <h2 id="kora-batches" className="site-display text-2xl font-medium">
        {HOME_COPY.batchesHeading}
      </h2>
      <table className="hidden w-full text-left sm:table">
        <thead className="text-sm text-zinc-500">
          <tr>
            <th className="py-2 pr-4 font-normal">{HOME_COPY.released}</th>
            <th className="py-2 pr-4 font-normal">{HOME_COPY.closes}</th>
            <th className="py-2 pr-4 font-normal">{HOME_COPY.ranked}</th>
            <th className="py-2 pr-4 font-normal">{HOME_COPY.status}</th>
            <th className="py-2 font-normal">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => {
            const c = cells(batch);
            return (
              <tr key={rowKey(batch)} className="border-t border-zinc-200">
                <td className="py-3 pr-4">{c.released}</td>
                <td className="py-3 pr-4">{c.closes}</td>
                <td className="py-3 pr-4">{c.ranked}</td>
                <td className="py-3 pr-4">{c.status}</td>
                <td className="py-3">
                  <Action batch={batch} start={start} starting={starting} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ul className="flex flex-col gap-3 sm:hidden">
        {batches.map((batch) => {
          const c = cells(batch);
          return (
            <li
              key={rowKey(batch)}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{c.status}</span>
                <Action batch={batch} start={start} starting={starting} />
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-zinc-500">{HOME_COPY.released}</dt>
                <dd>{c.released}</dd>
                <dt className="text-zinc-500">{HOME_COPY.closes}</dt>
                <dd>{c.closes}</dd>
                <dt className="text-zinc-500">{HOME_COPY.ranked}</dt>
                <dd>{c.ranked}</dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
