import { R } from "@alliance/common/result";
import type { TagDto } from "@alliance/shared/client/types.gen";
import { isEqual } from "es-toolkit";
import { useEffect, useMemo, useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { useLeaveGuard } from "../../lib/useLeaveGuard";
import { useTagsAdmin } from "../../lib/useTagsAdmin";
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
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { NewTagDialog } from "./NewTagDialog";
import { TagCard, type TagEdit, TagWrite } from "./TagCard";
import { byTagName, validateTag, valuesOf } from "./tagRules";

const CardsSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-section">
    {[0, 1, 2].map((card) => (
      <div
        key={card}
        className="flex flex-col gap-3 rounded-card border border-line bg-surface p-card"
      >
        <Skeleton className="h-control-sm w-40" />
        <Skeleton className="h-3.5 w-full max-w-prose" />
        <Skeleton className="h-control-sm w-24" />
      </div>
    ))}
  </div>
);

export default function TagsPage() {
  const tags = useTagsAdmin();
  const { mutateAsync: createTag } = tags.createTag;
  const { mutateAsync: updateTag } = tags.updateTag;
  const { mutateAsync: deleteTag } = tags.deleteTag;
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const [q, setQ] = useListSearch();
  const [creating, setCreating] = useState(false);
  const [edits, setEdits] = useState<Record<string, TagEdit>>({});
  const [writes, setWrites] = useState<Record<string, TagWrite>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const editsRef = useRef(edits);
  useEffect(() => {
    editsRef.current = edits;
  });
  const listRef = useRef<HTMLUListElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  // After a card's own button removes the card, focus goes to the next
  // card's first button, else the previous one's, else New tag.
  const [focusAfter, setFocusAfter] = useState<string | null>(null);

  const all = tags.tags;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...all]
      .filter(
        // A tag being edited stays in view, so a search never drops its fields.
        (tag) => tag.name.toLowerCase().includes(needle) || tag.id in edits,
      )
      .sort(byTagName);
  }, [all, q, edits]);
  const focus = useFocusAfterRemoval({
    ids: rows.map((tag) => tag.id),
    fallback: newRef,
  });

  const dirty = all.some(
    (tag) => tag.id in edits && !isEqual(edits[tag.id].values, valuesOf(tag)),
  );
  useLeaveGuard(dirty, { allowSamePath: true });

  useEffect(() => {
    if (focusAfter === null) return;
    const target =
      listRef.current?.querySelector<HTMLElement>(
        `[data-tag="${focusAfter}"] button`,
      ) ?? newRef.current;
    if (!target) return;
    target.focus();
    setFocusAfter(null);
  }, [focusAfter, rows]);

  const setEdit = (tagId: string, edit: TagEdit | null) =>
    setEdits(({ [tagId]: _, ...rest }) =>
      edit ? { ...rest, [tagId]: edit } : rest,
    );
  const setWrite = (tagId: string, write: TagWrite | null) =>
    setWrites(({ [tagId]: _, ...rest }) =>
      write ? { ...rest, [tagId]: write } : rest,
    );

  const save = (tag: TagDto): boolean => {
    const edit = edits[tag.id];
    const validated = validateTag({
      values: edit.values,
      otherNames: all
        .filter((other) => other.id !== tag.id)
        .map((other) => other.name),
      descriptionRequired: false,
    });
    if (!validated.ok) {
      setEdit(tag.id, { ...edit, errors: validated.error, refusal: null });
      return false;
    }
    setEdit(tag.id, { ...edit, errors: {}, refusal: null });
    setWrite(tag.id, TagWrite.Saving);
    void R.fromPromise(
      updateTag({ tagId: tag.id, body: validated.value }),
      (error) => adminRefusalMessage(error, "Couldn't save the tag."),
    ).then((result) => {
      setWrite(tag.id, null);
      if (result.ok) {
        success("Tag updated", result.value.name);
        // What was typed while the save ran stays open, still to be saved.
        if (!isEqual(editsRef.current[tag.id]?.values, edit.values)) return;
        setEdit(tag.id, null);
        setFocusAfter(tag.id);
        return;
      }
      const refusal = result.error;
      setEdits((current) =>
        tag.id in current
          ? { ...current, [tag.id]: { ...current[tag.id], refusal } }
          : current,
      );
    });
    return true;
  };

  const remove = async (tag: TagDto) => {
    const count = tag.users.length;
    const confirmed = await confirm({
      title: `Delete the tag “${tag.name}”?`,
      message: `${
        count === 0
          ? "No member has it"
          : `It comes off ${count === 1 ? "the 1 member who has it" : `the ${countOf(count, "member")} who have it`}`
      }. Task audiences and form checks that use it will treat every member as not having it. This can't be undone.`,
      confirmLabel: "Delete tag",
      destructive: true,
    });
    if (!confirmed) return;
    const removed = focus.removing(tag.id);
    setFailure(null);
    setWrite(tag.id, TagWrite.Deleting);
    const result = await R.fromPromise(deleteTag(tag.id), (error) =>
      adminRefusalMessage(
        error,
        `Couldn't delete the tag “${tag.name}”. If a general update, project update or reminder group uses it, remove it there first.`,
      ),
    );
    setWrite(tag.id, null);
    if (result.ok) {
      success("Tag deleted", tag.name);
      removed();
    } else {
      setFailure(result.error);
    }
  };

  return (
    <Page
      fill
      place={PlaceId.Tags}
      actions={
        <Button
          ref={newRef}
          variant={ButtonVariant.Primary}
          onClick={() => setCreating(true)}
        >
          New tag…
        </Button>
      }
      banner={
        <>
          <RefreshFailedBanner things="tags" query={tags} />
          {failure && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  onClick={() => setFailure(null)}
                >
                  Dismiss
                </Button>
              }
            >
              {failure}
            </Banner>
          )}
        </>
      }
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: tags.isLoading ? undefined : all.length,
          noun: "tag",
        })}
      >
        <SearchField label="Filter tags" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent cards>
        <ContentState
          loading={tags.isLoading}
          skeleton={<CardsSkeleton />}
          error={
            tags.isLoadingError
              ? adminRefusalMessage(tags.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load tags"
          onRetry={() => void tags.refetch()}
          retrying={tags.isFetching}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No tags yet"
          emptyAction={
            <Button
              variant={ButtonVariant.Default}
              onClick={() => setCreating(true)}
            >
              New tag…
            </Button>
          }
        >
          <ul ref={listRef} className="flex flex-col gap-section">
            {rows.map((tag) => (
              <TagCard
                key={tag.id}
                tag={tag}
                focusRow={focus.row(tag.id)}
                edit={edits[tag.id]}
                write={writes[tag.id]}
                onEdit={() =>
                  setEdit(tag.id, {
                    values: valuesOf(tag),
                    errors: {},
                    refusal: null,
                  })
                }
                onChange={(values) =>
                  setEdit(tag.id, { values, errors: {}, refusal: null })
                }
                onCancel={() => {
                  setEdit(tag.id, null);
                  setFocusAfter(tag.id);
                }}
                onSave={() => save(tag)}
                onDelete={() => void remove(tag)}
              />
            ))}
          </ul>
        </ContentState>
      </ListContent>
      {creating && (
        <NewTagDialog
          tags={all}
          create={createTag}
          onClose={() => setCreating(false)}
        />
      )}
    </Page>
  );
}
