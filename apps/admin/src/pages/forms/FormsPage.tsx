import type { FormSummaryDto } from "@alliance/shared/client/types.gen";
import {
  ResponseCountStatus,
  useFormResponseCountsAdmin,
} from "@alliance/shared/lib/useFormsAdmin";
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { formHref, taskHref } from "../../lib/hrefs";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import { PlaceId } from "../../places";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { linkClass, nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
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
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import {
  deleteFormMessage,
  formBuilderHref,
  formTitle,
  matchesFormSearch,
} from "./formRules";
import { useFormsList } from "./useFormsList";

const NUMBER = "text-right tabular-nums";
const ID = "font-mono text-xs text-fg-muted";
const COLUMN_CLASSES = [
  undefined,
  undefined,
  ID,
  NUMBER,
  NUMBER,
  NUMBER,
  undefined,
];

// The endpoint answers with a row per requested id, zeroes included, so a
// form whose batch came back without its row is unresolved, not empty.
const UNCOUNTED: Record<ResponseCountStatus, string> = {
  [ResponseCountStatus.Pending]: "Counting responses",
  [ResponseCountStatus.Error]: "Couldn't load the response count",
  [ResponseCountStatus.Ready]: "Couldn't load the response count",
};

export default function FormsPage() {
  const [q, setQ] = useListSearch();
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const list = useFormsList();
  const { forms } = list;
  const formIds = useMemo(() => forms.map((form) => form.id), [forms]);
  const counts = useFormResponseCountsAdmin(formIds);
  const rows = useMemo(
    () => forms.filter((form) => matchesFormSearch(form, q)),
    [forms, q],
  );
  const countsFailed = forms.some(
    (form) =>
      counts.byForm[form.id] === undefined &&
      counts.statusByForm[form.id] !== ResponseCountStatus.Pending,
  );

  const searchRef = useRef<{ focus: () => void }>(null);
  const focus = useFocusAfterRemoval({
    ids: rows.map((row) => row.id),
    fallback: searchRef,
  });

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteForm = async (form: FormSummaryDto) => {
    const title = formTitle(form);
    const confirmed = await confirm({
      title: `Delete the form “${title}”?`,
      message: deleteFormMessage({
        form,
        responseCount: counts.byForm[form.id],
      }),
      confirmLabel: "Delete form",
      destructive: true,
    });
    if (!confirmed) return;
    setDeleteError(null);
    const removed = focus.removing(form.id);
    setDeletingId(form.id);
    try {
      await list.deleteForm(form.id);
      success("Form deleted", title);
      removed();
    } catch (error) {
      const reason = adminRefusalMessage(error, "");
      setDeleteError(
        reason
          ? `Couldn't delete “${title}”: ${reason}`
          : `Couldn't delete “${title}”.`,
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Page
      fill
      place={PlaceId.Forms}
      banner={
        <>
          <RefreshFailedBanner things="forms" query={list} />
          {countsFailed && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  onClick={() => void list.refetchAll()}
                >
                  Try again
                </Button>
              }
            >
              Couldn&apos;t load some response counts. Those forms show
              &ldquo;—&rdquo;, and each still opens its responses.
            </Banner>
          )}
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
          total: list.isLoadingError ? undefined : forms.length,
          noun: "form",
        })}
      >
        <SearchField
          ref={searchRef}
          label="Filter forms"
          value={q}
          onChange={setQ}
        />
      </FilterBar>
      <ListContent>
        <ContentState
          things="forms"
          query={list}
          refreshBanner={false}
          skeleton={
            <TableSkeleton
              bleed
              columns={COLUMN_CLASSES.length}
              columnClassNames={COLUMN_CLASSES}
            />
          }
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No forms yet"
          emptyDescription="Forms are created from a task's Form tab, its variants or its follow-up forms."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Pages</TableHead>
                <TableHead className="text-right">Fields</TableHead>
                <TableHead className="text-right">Responses</TableHead>
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((form) => (
                <FormRow
                  key={form.id}
                  rowProps={focus.row(form.id)}
                  form={form}
                  count={counts.byForm[form.id]}
                  countStatus={
                    counts.statusByForm[form.id] ?? ResponseCountStatus.Error
                  }
                  deleting={deletingId === form.id}
                  onDelete={() => void deleteForm(form)}
                />
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
    </Page>
  );
}

function FormRow({
  rowProps,
  form,
  count,
  countStatus,
  deleting,
  onDelete,
}: {
  rowProps: { "data-focus-row": string };
  form: FormSummaryDto;
  /** Undefined while its batch is unresolved. */
  count: number | undefined;
  countStatus: ResponseCountStatus;
  deleting: boolean;
  onDelete: () => void;
}) {
  const title = formTitle(form);
  const task = form.usedInAction;
  return (
    <TableRow {...rowProps}>
      <TableCell className="max-w-80">
        <span className="flex min-w-0 items-center gap-2">
          <Link
            to={formBuilderHref(form)}
            title={title}
            className={cn(nameLinkClass, "truncate")}
          >
            {title}
          </Link>
          {!form.schemaCounts && (
            <Badge tone={BadgeTone.Danger} className="self-center">
              Unreadable schema
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell truncate title={task?.name}>
        {task ? (
          <Link to={taskHref(task.id)} className={linkClass}>
            {task.name}
          </Link>
        ) : (
          // The index names no task for a follow-up form, so this can't say "No task".
          <span className="text-fg-muted">—</span>
        )}
      </TableCell>
      <TableCell className={ID}>{form.id}</TableCell>
      <TableCell className={NUMBER}>
        {form.schemaCounts ? formatCount(form.schemaCounts.pages) : "—"}
      </TableCell>
      <TableCell className={NUMBER}>
        {form.schemaCounts ? formatCount(form.schemaCounts.fields) : "—"}
      </TableCell>
      <TableCell className={NUMBER}>
        <Link
          to={formHref(form.id, "responses")}
          className={linkClass}
          aria-label={`Responses: ${title}, form ${form.id}, ${
            count === undefined ? UNCOUNTED[countStatus] : formatCount(count)
          }`}
          title={count === undefined ? UNCOUNTED[countStatus] : undefined}
        >
          {count === undefined ? "—" : formatCount(count)}
        </Link>
      </TableCell>
      <TableCell actions>
        <Button
          size="small"
          aria-label={`Delete: ${title}, form ${form.id}`}
          busy={deleting}
          onClick={onDelete}
        >
          Delete
        </Button>
      </TableCell>
    </TableRow>
  );
}
