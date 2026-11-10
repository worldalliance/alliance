import type {
  KoraAdminAbandonedSignupDto,
  KoraAdminParticipantDto,
} from "@alliance/shared/client";
import { downloadBlob } from "@alliance/sharedweb/lib/downloadBlob";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { format } from "date-fns";
import React, { useMemo, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import { KoraBatches } from "../components/KoraBatches";
import { KoraNotifyWaitlist } from "../components/KoraNotifyWaitlist";
import { KoraProjectStatusControl } from "../components/KoraProjectStatusControl";
import SortHeader from "../components/SortHeader";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  abandonedMethod,
  buildKoraCsv,
  contactOf,
  formatKoraDate,
  matchesSearch,
  participantMethods,
  ParticipantSort,
  signupsPerDay,
  SortDirection,
  sortParticipants,
} from "../lib/koraParticipants";
import {
  KoraRecordKind,
  useDeleteKoraRecordAdmin,
  useKoraParticipantsAdmin,
} from "../lib/useKoraParticipantsAdmin";

type Deleting = {
  kind: KoraRecordKind;
  id: string;
  title: string;
  message: string;
  done: string;
};

const TITLE = <title>Kora participants - Admin</title>;
const CELL = "px-3 py-2 align-top";

const KoraParticipantsPage: React.FC = () => {
  const overview = useKoraParticipantsAdmin();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({
    by: ParticipantSort.SignedUp,
    direction: SortDirection.Desc,
  });
  const [deleting, setDeleting] = useState<Deleting | null>(null);
  const remove = useDeleteKoraRecordAdmin({
    onSuccess: () => {
      if (deleting) toast.success(deleting.done);
      setDeleting(null);
    },
    onError: (err) => {
      toast.error(adminRefusalMessage(err, "Couldn't delete. Try again."));
      setDeleting(null);
      console.error(err);
    },
  });

  const participants = useMemo(
    () =>
      sortParticipants(
        (overview.data?.participants ?? []).filter((participant) =>
          matchesSearch([participant.name, contactOf(participant)], query),
        ),
        sort,
      ),
    [overview.data, query, sort],
  );
  const abandoned = useMemo(
    () =>
      (overview.data?.abandonedSignups ?? []).filter((signup) =>
        matchesSearch([signup.destination], query),
      ),
    [overview.data, query],
  );
  const perDay = useMemo(
    () => signupsPerDay(overview.data?.participants ?? []),
    [overview.data],
  );

  if (overview.isPending) {
    return (
      <div className="p-5">
        {TITLE}
        <p>Loading…</p>
      </div>
    );
  }
  if (overview.isError) {
    return (
      <div className="p-5">
        {TITLE}
        <p className="text-red-600" role="alert">
          {adminRefusalMessage(
            overview.error,
            "Couldn't load Kora participants. Reload to try again.",
          )}
        </p>
      </div>
    );
  }

  const data = overview.data;
  const recovered = data.abandonedSignups.filter((s) => s.recovered).length;
  const toggleSort = (by: ParticipantSort) =>
    setSort((current) => ({
      by,
      direction:
        current.by === by && current.direction === SortDirection.Asc
          ? SortDirection.Desc
          : SortDirection.Asc,
    }));
  const exportCsv = () =>
    downloadBlob(
      new Blob(["﻿" + buildKoraCsv(data)], {
        type: "text/csv;charset=utf-8;",
      }),
      `kora-participants-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
  const askDeleteParticipant = (participant: KoraAdminParticipantDto) =>
    setDeleting({
      kind: KoraRecordKind.Participant,
      id: participant.id,
      title: `Delete ${participant.name}?`,
      message: `Deletes ${participant.name}'s participant account and any abandoned signup or signup in progress for ${contactOf(participant)}, and signs them out on every device. This can't be undone.`,
      done: `Deleted ${participant.name}`,
    });
  const askDeleteAbandoned = (signup: KoraAdminAbandonedSignupDto) =>
    setDeleting({
      kind: KoraRecordKind.AbandonedSignup,
      id: signup.id,
      title: `Delete the abandoned signup for ${signup.destination}?`,
      message:
        "Deletes this record and its contact details, and ends any signup this contact has in progress. This can't be undone.",
      done: `Deleted the abandoned signup for ${signup.destination}`,
    });

  return (
    <div className="p-5 space-y-6 max-w-6xl">
      {TITLE}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-bold text-lg">Kora participants</h1>
          <p className="text-sm text-zinc-600">
            People who signed up on the Safer Chatbots for Children project
            page.
          </p>
        </div>
        <Button
          color={ButtonColor.Black}
          size="small"
          onClick={exportCsv}
          disabled={
            data.participants.length + data.abandonedSignups.length === 0
          }
        >
          Export CSV
        </Button>
      </div>

      <KoraProjectStatusControl />

      <KoraBatches />

      <KoraNotifyWaitlist />

      <dl className="flex flex-wrap gap-6 text-sm">
        <div>
          <dt className="text-zinc-500">Participants</dt>
          <dd className="text-2xl font-semibold">{data.participants.length}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">People who abandoned signup</dt>
          <dd className="text-2xl font-semibold">
            {data.abandonedSignups.length}
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {recovered} came back
            </span>
          </dd>
        </div>
      </dl>

      {perDay.length > 0 && (
        <section aria-labelledby="kora-per-day">
          <h2 id="kora-per-day" className="font-semibold mb-2">
            Signups per day (UTC)
          </h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {perDay.map(({ day, count }) => (
              <li
                key={day}
                className="rounded border border-zinc-200 bg-white px-2 py-1"
              >
                {day}: <span className="font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <label className="block max-w-sm text-sm">
        <span className="text-zinc-700">Search by name, email or phone</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1.5"
        />
      </label>

      <section aria-labelledby="kora-participants" className="space-y-2">
        <h2 id="kora-participants" className="font-semibold">
          Participants
        </h2>
        {participants.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {data.participants.length === 0
              ? "No one has signed up yet."
              : "No participants match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <SortHeader
                    label="Name"
                    active={sort.by === ParticipantSort.Name}
                    direction={sort.direction}
                    onSort={() => toggleSort(ParticipantSort.Name)}
                  />
                  <SortHeader
                    label="Email or phone"
                    active={sort.by === ParticipantSort.Contact}
                    direction={sort.direction}
                    onSort={() => toggleSort(ParticipantSort.Contact)}
                  />
                  <th className={CELL}>Sign-in methods</th>
                  <th className={CELL}>Time zone</th>
                  <SortHeader
                    label="Signed up"
                    active={sort.by === ParticipantSort.SignedUp}
                    direction={sort.direction}
                    onSort={() => toggleSort(ParticipantSort.SignedUp)}
                  />
                  <th className={CELL}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {participants.map((participant) => (
                  <tr key={participant.id}>
                    <td className={CELL}>{participant.name}</td>
                    <td className={CELL}>{contactOf(participant)}</td>
                    <td className={CELL}>
                      {participantMethods(participant).join(", ")}
                    </td>
                    <td className={CELL}>{participant.timeZone ?? "—"}</td>
                    <td className={CELL}>
                      {formatKoraDate(participant.createdAt)}
                    </td>
                    <td className={CELL}>
                      <Button
                        color={ButtonColor.White}
                        size="small"
                        onClick={() => askDeleteParticipant(participant)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="kora-abandoned" className="space-y-2">
        <h2 id="kora-abandoned" className="font-semibold">
          Abandoned signups
        </h2>
        <p className="text-sm text-zinc-600">
          People who verified their email or phone but left before entering
          their name, listed once each with their latest attempt. “Came back”
          means they have since signed up.
        </p>
        {abandoned.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {data.abandonedSignups.length === 0
              ? "No abandoned signups."
              : "No abandoned signups match your search."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <th className={CELL}>Email or phone</th>
                  <th className={CELL}>Verified with</th>
                  <th className={CELL}>Verified</th>
                  <th className={CELL}>Status</th>
                  <th className={CELL}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {abandoned.map((signup) => (
                  <tr key={signup.id}>
                    <td className={CELL}>{signup.destination}</td>
                    <td className={CELL}>{abandonedMethod(signup)}</td>
                    <td className={CELL}>
                      {formatKoraDate(signup.verifiedAt)}
                    </td>
                    <td className={CELL}>
                      {signup.recovered ? "Came back" : "Abandoned"}
                    </td>
                    <td className={CELL}>
                      <Button
                        color={ButtonColor.White}
                        size="small"
                        onClick={() => askDeleteAbandoned(signup)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={deleting !== null}
        title={deleting?.title ?? ""}
        message={deleting?.message ?? ""}
        confirmLabel="Delete"
        isLoading={remove.isPending}
        onConfirm={() =>
          deleting && remove.mutate({ kind: deleting.kind, id: deleting.id })
        }
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
};

export default KoraParticipantsPage;
