import type { ExternalShareTargetDto } from "@alliance/shared/client/types.gen";
import { useMemo, useRef, useState } from "react";
import { adminRefusalMessage, rowRefusalMessage } from "../../lib/adminRefusal";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useCreateExternalShareTargetAdmin,
  useDeleteExternalShareTargetAdmin,
  useExternalShareTargetsAdmin,
} from "../../lib/useExternalShareTargetsAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { useFocusFirstInvalid } from "../../ui/templates/Form";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { EditShareTargetDialog } from "./EditShareTargetDialog";
import { FailureBanner } from "./FailureBanner";
import { ListCreateForm } from "./ListCreateForm";
import { ShareTargetFields } from "./ShareTargetFields";
import {
  EMPTY_SHARE_TARGET,
  exampleShareLink,
  type ShareTargetErrors,
  validateShareTarget,
} from "./shareTargetRules";

const withoutId = (ids: ReadonlySet<number>, id: number) => {
  const next = new Set(ids);
  next.delete(id);
  return next;
};

export function ShareTargetsTab() {
  const [q, setQ] = useListSearch();
  const confirm = useConfirmOnPage();
  const list = useExternalShareTargetsAdmin();
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list.data ?? []).filter((target) =>
      target.name.toLowerCase().includes(needle),
    );
  }, [list.data, q]);

  const [draft, setDraft] = useState(EMPTY_SHARE_TARGET);
  const [errors, setErrors] = useState<ShareTargetErrors>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [createRefusal, setCreateRefusal] = useState<string | null>(null);
  const create = useCreateExternalShareTargetAdmin({
    onSuccess: () => setDraft(EMPTY_SHARE_TARGET),
    onError: (error) =>
      setCreateRefusal(
        adminRefusalMessage(error, "Couldn't create the share target."),
      ),
  });
  const submit = () => {
    const validated = validateShareTarget(draft);
    if (!validated.ok) {
      setErrors(validated.error);
      focusFirstInvalid();
      return;
    }
    setCreateRefusal(null);
    create.mutate(validated.value);
  };
  const example = exampleShareLink(draft);

  const [failure, setFailure] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExternalShareTargetDto | null>(null);
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const searchRef = useRef<{ focus: () => void }>(null);
  const focus = useFocusAfterRemoval({
    ids: rows.map((target) => target.id),
    fallback: searchRef,
  });
  const remove = useDeleteExternalShareTargetAdmin({ onError: () => {} });
  const deleteTarget = async (target: ExternalShareTargetDto) => {
    const confirmed = await confirm({
      title: `Delete the share target “${target.name}”?`,
      message:
        "Every member's share link to it is deleted with it, so a signup that arrives with one of those codes is no longer credited to the member. A form block or field that uses this target stops giving members a link. This can't be undone.",
      confirmLabel: "Delete share target",
      destructive: true,
    });
    if (!confirmed) return;
    setFailure(null);
    setDeletingIds((prev) => new Set(prev).add(target.id));
    remove.mutate(target.id, {
      onSuccess: focus.removing(target.id),
      onError: (error) =>
        setFailure(
          rowRefusalMessage(error, `Couldn't delete “${target.name}”`),
        ),
      onSettled: () => setDeletingIds((prev) => withoutId(prev, target.id)),
    });
  };

  return (
    <>
      <RefreshFailedBanner things="share targets" query={list} />
      <FailureBanner message={failure} onDismiss={() => setFailure(null)} />
      <ListCreateForm
        label="New share target"
        formRef={formRef}
        onSubmit={submit}
        submitLabel="Create share target"
        busy={create.isPending}
        error={createRefusal}
        note={
          example ? (
            <>
              A member's link: <span className="font-mono">{example}</span>
            </>
          ) : (
            "A form's share link block or field sends each member to this URL, with the member's own code as the parameter."
          )
        }
      >
        <ShareTargetFields
          row
          readOnly={create.isPending}
          values={draft}
          errors={errors}
          onChange={(next) => {
            setDraft(next);
            setErrors({});
          }}
        />
      </ListCreateForm>
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: list.data?.length,
          noun: "share target",
        })}
      >
        <SearchField
          ref={searchRef}
          label="Filter share targets"
          value={q}
          onChange={setQ}
        />
      </FilterBar>
      <ListContent>
        <ContentState
          things="share targets"
          query={list}
          refreshBanner={false}
          skeleton={<TableSkeleton bleed columns={4} />}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No share targets yet"
          emptyDescription="An address outside the Alliance that a form can give each member their own link to."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Example of a member's link</TableHead>
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((target) => (
                <TableRow key={target.id} {...focus.row(target.id)}>
                  <TableCell truncate className="font-medium">
                    {target.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-fg-muted">
                    {target.id}
                  </TableCell>
                  <TableCell truncate className="font-mono text-xs">
                    {exampleShareLink(target) ?? "—"}
                  </TableCell>
                  <TableCell actions>
                    <Button
                      size="small"
                      aria-label={`Edit: ${target.name}`}
                      onClick={() => setEditing(target)}
                    >
                      Edit…
                    </Button>
                    <Button
                      size="small"
                      variant={ButtonVariant.Default}
                      aria-label={`Delete: ${target.name}`}
                      busy={deletingIds.has(target.id)}
                      onClick={() => void deleteTarget(target)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
      {editing && (
        <EditShareTargetDialog
          target={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
