import type {
  KoraAdminAbandonedSignupDto,
  KoraAdminParticipantDto,
} from "@alliance/shared/client";
import { downloadBlob } from "@alliance/sharedweb/lib/downloadBlob";
import { format } from "date-fns";
import { useMemo, useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDate, formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import {
  abandonedMethod,
  buildKoraCsv,
  contactOf,
  matchesSearch,
  participantMethods,
  ParticipantSort,
  signupsPerDay,
  SortDirection,
  sortParticipants,
} from "../../lib/koraParticipants";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  KoraRecordKind,
  useDeleteKoraRecordAdmin,
  useKoraParticipantsAdmin,
} from "../../lib/useKoraParticipantsAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortDirection as TableSortDirection,
} from "../../ui/Table";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import { Panel, PanelNote } from "../../ui/templates/Overview";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { useParticipantSort } from "./useParticipantSort";

type Deletion = {
  kind: KoraRecordKind;
  id: string;
  title: string;
  message: string;
  confirmLabel: string;
  done: string;
  fallback: string;
  removed: () => void;
};

const TABLE_DIRECTION: Record<SortDirection, TableSortDirection> = {
  [SortDirection.Asc]: TableSortDirection.Ascending,
  [SortDirection.Desc]: TableSortDirection.Descending,
};

const panelSkeleton = (columns: number, rows: number) => (
  <div className="overflow-hidden rounded-card border border-line bg-surface">
    <div className="flex min-h-12 items-center border-b border-line px-card">
      <Skeleton className="h-4 w-40" />
    </div>
    <TableSkeleton columns={columns} rows={rows} />
  </div>
);

export function ParticipantsTab() {
  const overview = useKoraParticipantsAdmin();
  const [q, setQ] = useListSearch();
  const [sort, toggleSort] = useParticipantSort();
  const sortedBy = (column: ParticipantSort) =>
    sort.by === column ? TABLE_DIRECTION[sort.direction] : null;
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const remove = useDeleteKoraRecordAdmin({
    onSuccess: () => undefined,
    onError: () => undefined,
  });
  const searchRef = useRef<{ focus: () => void }>(null);

  const participants = useMemo(
    () =>
      sortParticipants(
        (overview.data?.participants ?? []).filter((participant) =>
          matchesSearch([participant.name, contactOf(participant)], q),
        ),
        sort,
      ),
    [overview.data, q, sort],
  );
  const abandoned = useMemo(
    () =>
      (overview.data?.abandonedSignups ?? []).filter((signup) =>
        matchesSearch([signup.destination], q),
      ),
    [overview.data, q],
  );
  const perDay = useMemo(
    () => signupsPerDay(overview.data?.participants ?? []),
    [overview.data],
  );

  const participantFocus = useFocusAfterRemoval({
    ids: participants.map((participant) => participant.id),
    fallback: searchRef,
  });
  const abandonedFocus = useFocusAfterRemoval({
    ids: abandoned.map((signup) => signup.id),
    fallback: searchRef,
  });

  const data = overview.data;
  const total = data
    ? data.participants.length + data.abandonedSignups.length
    : 0;

  const exportCsv = () => {
    if (!data) return;
    downloadBlob(
      new Blob(["﻿" + buildKoraCsv(data)], {
        type: "text/csv;charset=utf-8;",
      }),
      `kora-participants-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );
  };

  const ask = async (deletion: Deletion) => {
    const confirmed = await confirm({
      title: deletion.title,
      message: deletion.message,
      confirmLabel: deletion.confirmLabel,
      destructive: true,
    });
    if (!confirmed) return;
    setProblem(null);
    remove.mutate(
      { kind: deletion.kind, id: deletion.id },
      {
        onSuccess: () => {
          success(deletion.done);
          deletion.removed();
        },
        onError: (error) =>
          setProblem(adminRefusalMessage(error, deletion.fallback)),
      },
    );
  };

  const deleteParticipant = (participant: KoraAdminParticipantDto) =>
    ask({
      kind: KoraRecordKind.Participant,
      id: participant.id,
      title: `Delete ${participant.name}?`,
      message: `Deletes ${participant.name}'s participant account, their reviews and profile answers, and any abandoned signup or signup in progress for ${contactOf(participant)}, and signs them out on every device. They aren't told. This can't be undone.`,
      confirmLabel: "Delete participant",
      done: `Deleted ${participant.name}`,
      fallback: "Couldn't delete the participant.",
      removed: participantFocus.removing(participant.id),
    });
  const deleteAbandoned = (signup: KoraAdminAbandonedSignupDto) =>
    ask({
      kind: KoraRecordKind.AbandonedSignup,
      id: signup.id,
      title: `Delete the abandoned signup for ${signup.destination}?`,
      message:
        "Deletes this record and its contact details, and ends any signup this contact has in progress. This can't be undone.",
      confirmLabel: "Delete signup",
      done: `Deleted the abandoned signup for ${signup.destination}`,
      fallback: "Couldn't delete the abandoned signup.",
      removed: abandonedFocus.removing(signup.id),
    });
  const deleting = (id: string) =>
    remove.isPending && remove.variables.id === id;

  return (
    <>
      <RefreshFailedBanner things="participants" query={overview} />
      {problem && (
        <Banner
          tone={BannerTone.Danger}
          action={
            <Button
              size="small"
              variant={ButtonVariant.Ghost}
              onClick={() => setProblem(null)}
            >
              Dismiss
            </Button>
          }
        >
          {problem}
        </Banner>
      )}
      <FilterBar
        actions={
          <Button
            size="small"
            variant={ButtonVariant.Default}
            disabled={total === 0}
            onClick={exportCsv}
          >
            Export CSV
          </Button>
        }
      >
        <SearchField
          ref={searchRef}
          label="Search by name, email or phone"
          value={q}
          onChange={setQ}
          className="w-72"
        />
      </FilterBar>
      <ListContent cards>
        <ContentState
          things="participants"
          query={overview}
          refreshBanner={false}
          skeleton={
            <div className="flex flex-col gap-section">
              {panelSkeleton(6, 8)}
              {panelSkeleton(5, 3)}
            </div>
          }
        >
          <div className="flex flex-col gap-section">
            <Panel
              title="Participants"
              description={listCount({
                shown: participants.length,
                total: data?.participants.length,
                noun: "participant",
              })}
              flush
            >
              <ContentState
                loading={false}
                skeleton={null}
                errorTitle=""
                empty={participants.length === 0}
                filtered={q !== ""}
                onClearFilters={() => setQ("")}
                emptyTitle="No one has signed up yet"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        sort={{
                          direction: sortedBy(ParticipantSort.Name),
                          onSort: () => toggleSort(ParticipantSort.Name),
                        }}
                      >
                        Name
                      </TableHead>
                      <TableHead
                        sort={{
                          direction: sortedBy(ParticipantSort.Contact),
                          onSort: () => toggleSort(ParticipantSort.Contact),
                        }}
                      >
                        Email or phone
                      </TableHead>
                      <TableHead>Sign-in methods</TableHead>
                      <TableHead>Time zone</TableHead>
                      <TableHead
                        sort={{
                          direction: sortedBy(ParticipantSort.SignedUp),
                          onSort: () => toggleSort(ParticipantSort.SignedUp),
                        }}
                      >
                        Signed up
                      </TableHead>
                      <TableHead actions>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((participant) => (
                      <TableRow
                        key={participant.id}
                        {...participantFocus.row(participant.id)}
                      >
                        <TableCell truncate className="font-medium">
                          {participant.name}
                        </TableCell>
                        <TableCell truncate>{contactOf(participant)}</TableCell>
                        <TableCell>
                          {participantMethods(participant).join(", ")}
                        </TableCell>
                        <TableCell>{participant.timeZone ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(participant.createdAt)}
                        </TableCell>
                        <TableCell actions>
                          <Button
                            size="small"
                            variant={ButtonVariant.DangerOutline}
                            aria-label={`Delete: ${participant.name}, ${contactOf(participant)}`}
                            busy={deleting(participant.id)}
                            onClick={() => void deleteParticipant(participant)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ContentState>
            </Panel>

            <Panel
              title="Abandoned signups"
              description={
                data && data.abandonedSignups.length > 0
                  ? `${listCount({
                      shown: abandoned.length,
                      total: data.abandonedSignups.length,
                      noun: "abandoned signup",
                    })} · ${formatCount(abandoned.filter((s) => s.recovered).length)} came back`
                  : undefined
              }
              flush
            >
              <p className="border-b border-line px-card py-3 text-fg-muted">
                People who verified their email or phone but left before
                entering their name, listed once each with their latest attempt.
                {' "Came back" '}means they have since signed up.
              </p>
              <ContentState
                loading={false}
                skeleton={null}
                errorTitle=""
                empty={abandoned.length === 0}
                filtered={q !== ""}
                onClearFilters={() => setQ("")}
                emptyTitle="No abandoned signups"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email or phone</TableHead>
                      <TableHead>Verified with</TableHead>
                      <TableHead>Verified</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead actions>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abandoned.map((signup) => (
                      <TableRow
                        key={signup.id}
                        {...abandonedFocus.row(signup.id)}
                      >
                        <TableCell truncate className="font-medium">
                          {signup.destination}
                        </TableCell>
                        <TableCell>{abandonedMethod(signup)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(signup.verifiedAt)}
                        </TableCell>
                        <TableCell>
                          {signup.recovered ? (
                            <Badge tone={BadgeTone.Success}>Came back</Badge>
                          ) : (
                            <Badge>Abandoned</Badge>
                          )}
                        </TableCell>
                        <TableCell actions>
                          <Button
                            size="small"
                            variant={ButtonVariant.DangerOutline}
                            aria-label={`Delete: abandoned signup for ${signup.destination}`}
                            busy={deleting(signup.id)}
                            onClick={() => void deleteAbandoned(signup)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ContentState>
            </Panel>

            <Panel
              title="Signups per day"
              description="Days in UTC, newest first"
              flush={perDay.length > 0}
            >
              {perDay.length === 0 ? (
                <PanelNote>No signups yet.</PanelNote>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>
                      <TableHead className="text-right">Signups</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perDay.map(({ day, count }) => (
                      <TableRow key={day}>
                        <TableCell className="font-medium">
                          {formatDate(`${day}T00:00:00Z`, { timeZone: "UTC" })}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(count)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
          </div>
        </ContentState>
      </ListContent>
    </>
  );
}
