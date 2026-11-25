import type { ActionPartnershipResponseDto } from "@alliance/shared/client/types.gen";
import { useMemo, useRef, useState } from "react";
import { rowRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useDeleteOutreachPartnershipResponseAdmin,
  useOutreachPartnershipResponsesAdmin,
} from "../../lib/useOutreachPartnershipResponsesAdmin";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { matchesSearch, needsReview } from "./partnershipRules";
import { ResponseCard } from "./ResponseCard";

const NONE: ActionPartnershipResponseDto[] = [];

const queueLine = (responses: ActionPartnershipResponseDto[] | undefined) => {
  if (!responses) return "";
  const awaiting = responses.filter(needsReview).length;
  if (awaiting === 0) {
    return responses.length === 0 ? "" : "Every response has a note.";
  }
  return `${countOf(awaiting, "response")} ${awaiting === 1 ? "has" : "have"} no note yet. Adding a note takes a response off the queue.`;
};

function CardsSkeleton() {
  return (
    <div className="flex flex-col gap-section">
      {[0, 1, 2].map((card) => (
        <div
          key={card}
          className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card"
        >
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3.5 w-96 max-w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function OutreachPartnershipsPage() {
  const [q, setQ] = useListSearch();
  const confirm = useConfirmOnPage();
  const list = useOutreachPartnershipResponsesAdmin();
  const rows = useMemo(
    () => (list.data ?? NONE).filter((response) => matchesSearch(response, q)),
    [list.data, q],
  );

  const [deletingIds, setDeletingIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletion = useDeleteOutreachPartnershipResponseAdmin({
    onError: () => {},
  });

  const searchRef = useRef<{ focus: () => void }>(null);
  const focus = useFocusAfterRemoval({
    ids: rows.map((response) => response.id),
    fallback: searchRef,
  });

  // From the server's deleteResponseAdmin: a soft delete of the response and
  // what hangs off it, with nothing in the admin to bring either back.
  const deleteResponse = async (response: ActionPartnershipResponseDto) => {
    const confirmed = await confirm({
      title: `Delete the response from “${response.organizationName}”?`,
      message:
        "The response and its internal notes leave this list for every admin. The admin has no way to restore them.",
      confirmLabel: "Delete response",
      destructive: true,
    });
    if (!confirmed) return;
    setDeleteError(null);
    setDeletingIds((ids) => new Set(ids).add(response.id));
    const focusNext = focus.removing(response.id);
    // Not `mutate`: its callbacks run for the latest call only, and two
    // deletes can be in flight.
    deletion
      .mutateAsync(response.id)
      .then(focusNext, (error: unknown) =>
        setDeleteError(
          rowRefusalMessage(
            error,
            `Couldn't delete the response from ${response.organizationName}`,
          ),
        ),
      )
      .finally(() =>
        setDeletingIds((ids) => {
          const next = new Set(ids);
          next.delete(response.id);
          return next;
        }),
      );
  };

  return (
    <Page
      fill
      place={PlaceId.OutreachPartnerships}
      description={queueLine(list.data)}
      banner={
        <>
          <RefreshFailedBanner things="partnership responses" query={list} />
          {deleteError && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  onClick={() => setDeleteError(null)}
                >
                  Dismiss
                </Button>
              }
            >
              {deleteError}
            </Banner>
          )}
        </>
      }
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: list.data?.length,
          noun: "response",
        })}
      >
        <SearchField
          ref={searchRef}
          label="Filter responses"
          value={q}
          onChange={setQ}
        />
      </FilterBar>
      <ListContent cards>
        <ContentState
          things="partnership responses"
          query={list}
          refreshBanner={false}
          skeleton={<CardsSkeleton />}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No partnership responses yet"
          emptyDescription="An organization's answers to the partnership form are listed here."
        >
          <div className="flex flex-col gap-section">
            {rows.map((response) => (
              <ResponseCard
                key={response.id}
                response={response}
                focusRow={focus.row(response.id)}
                deleting={deletingIds.has(response.id)}
                onDelete={() => void deleteResponse(response)}
              />
            ))}
          </div>
        </ContentState>
      </ListContent>
    </Page>
  );
}
