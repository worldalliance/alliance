import type { HostedDocDto } from "@alliance/shared/client";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import { useMemo, useRef, useState } from "react";
import { adminRefusalMessage, rowRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  useCreateHostedDocAdmin,
  useDeleteHostedDocAdmin,
  useHostedDocsAdmin,
} from "../../lib/useHostedDocsAdmin";
import Button from "../../ui/Button";
import { FileInput } from "../../ui/FileInput";
import { Input } from "../../ui/Input";
import { MoreMenu } from "../../ui/MoreMenu";
import NewTabMark from "../../ui/NewTabMark";
import { linkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Field, useFocusFirstInvalid } from "../../ui/templates/Form";
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
import { EditHostedDocNotesDialog } from "./EditHostedDocNotesDialog";
import { FailureBanner } from "./FailureBanner";
import {
  EMPTY_HOSTED_DOC,
  type HostedDocErrors,
  hostedDocUrl,
  matchesHostedDoc,
  validateHostedDoc,
  withFile,
} from "./hostedDocRules";
import { ListCreateForm } from "./ListCreateForm";
import { ReplaceHostedDocFileDialog } from "./ReplaceHostedDocFileDialog";
import { useCopyLink } from "./useCopyLink";

const VIEWS_COLUMN = "text-right tabular-nums";

const byline = (name: string | null, at: string) => (
  <>
    <span>{name ?? "Deleted admin"}</span>{" "}
    <span className="text-fg-muted">{formatDateTime(at)}</span>
  </>
);

export function HostedDocsTab() {
  const [q, setQ] = useListSearch();
  const confirm = useConfirmOnPage();
  const docs = useHostedDocsAdmin();
  const rows = useMemo(
    () => (docs.data ?? []).filter((doc) => matchesHostedDoc(doc, q)),
    [docs.data, q],
  );

  const [draft, setDraft] = useState(EMPTY_HOSTED_DOC);
  const [errors, setErrors] = useState<HostedDocErrors>({});
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  const [createRefusal, setCreateRefusal] = useState<string | null>(null);
  const create = useCreateHostedDocAdmin({
    onSuccess: () => setDraft(EMPTY_HOSTED_DOC),
    onError: (error) =>
      setCreateRefusal(
        adminRefusalMessage(error, "Couldn't upload the document."),
      ),
  });
  const submit = () => {
    const validated = validateHostedDoc(draft);
    if (!validated.ok) {
      setErrors(validated.error);
      focusFirstInvalid();
      return;
    }
    setCreateRefusal(null);
    create.mutate(validated.value);
  };
  const edit = (next: typeof draft) => {
    setDraft(next);
    setErrors({});
  };

  const [failure, setFailure] = useState<string | null>(null);
  const copy = useCopyLink(setFailure);
  const [editingNotes, setEditingNotes] = useState<HostedDocDto | null>(null);
  const [replacing, setReplacing] = useState<HostedDocDto | null>(null);
  const searchRef = useRef<{ focus: () => void }>(null);
  const focus = useFocusAfterRemoval({
    ids: rows.map((doc) => doc.id),
    fallback: searchRef,
  });
  const remove = useDeleteHostedDocAdmin({
    onSuccess: () => {},
    onError: () => {},
  });
  const deleteDoc = async (doc: HostedDocDto) => {
    const confirmed = await confirm({
      title: `Delete the document “${doc.slug}”?`,
      message: `/docs/${doc.slug} stops working within five minutes for everyone who has the link, and a new document can take its ID. This can't be undone.`,
      confirmLabel: "Delete document",
      destructive: true,
    });
    if (!confirmed) return;
    setFailure(null);
    remove.mutate(doc.id, {
      onSuccess: focus.removing(doc.id),
      onError: (error) =>
        setFailure(rowRefusalMessage(error, `Couldn't delete ${doc.slug}`)),
    });
  };

  return (
    <>
      <RefreshFailedBanner things="hosted docs" query={docs} />
      <FailureBanner message={failure} onDismiss={() => setFailure(null)} />
      <Banner tone={BannerTone.Warning}>
        {`These PDFs are public at ${new URL(getInviteBaseUrl()).host}/docs/<ID>: anyone with the link can open them, and search engines may index them.`}
      </Banner>
      <ListCreateForm
        label="Upload a document"
        formRef={formRef}
        onSubmit={submit}
        submitLabel="Upload"
        busy={create.isPending}
        error={createRefusal}
        note="The ID can't be changed later. Views count every opening, repeat visits and automated requests included."
      >
        <Field label="PDF" error={errors.file} className="w-72">
          {(control) => (
            <FileInput
              {...control}
              accept="application/pdf"
              disabled={create.isPending}
              value={draft.file ? [draft.file] : []}
              onChange={(files) => edit(withFile(draft, files[0] ?? null))}
            />
          )}
        </Field>
        <Field label="ID" error={errors.slug} className="w-72">
          {(control) => (
            <Input
              {...control}
              value={draft.slug}
              maxLength={104}
              readOnly={create.isPending}
              placeholder="2026-GrantPilot.pdf"
              onChange={(event) => edit({ ...draft, slug: event.target.value })}
            />
          )}
        </Field>
        <Field
          label="Notes"
          mark="optional"
          help="For staff only."
          error={errors.notes}
          className="min-w-64 flex-1"
        >
          {(control) => (
            <Input
              {...control}
              value={draft.notes}
              maxLength={2000}
              readOnly={create.isPending}
              onChange={(event) =>
                edit({ ...draft, notes: event.target.value })
              }
            />
          )}
        </Field>
      </ListCreateForm>
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: docs.data?.length,
          noun: "hosted doc",
        })}
      >
        <SearchField
          ref={searchRef}
          label="Filter hosted docs"
          value={q}
          onChange={setQ}
        />
      </FilterBar>
      <ListContent>
        <ContentState
          things="hosted docs"
          query={docs}
          refreshBanner={false}
          skeleton={
            <TableSkeleton
              bleed
              columns={6}
              columnClassNames={[undefined, undefined, VIEWS_COLUMN]}
            />
          }
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No hosted docs yet"
          emptyDescription="Upload a PDF to give it a public link."
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>File replaced</TableHead>
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((doc) => (
                <TableRow key={doc.id} {...focus.row(doc.id)}>
                  <TableCell truncate title={doc.slug} className="font-medium">
                    <a
                      href={hostedDocUrl(doc.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className={linkClass}
                    >
                      {doc.slug}
                      <NewTabMark />
                    </a>
                  </TableCell>
                  <TableCell truncate>{doc.notes || "—"}</TableCell>
                  <TableCell className={VIEWS_COLUMN}>
                    {formatCount(doc.views)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {byline(doc.uploadedByName, doc.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {doc.fileReplacedAt
                      ? byline(doc.fileReplacedByName, doc.fileReplacedAt)
                      : "—"}
                  </TableCell>
                  <TableCell actions>
                    <Button
                      size="small"
                      aria-label={`Copy link: ${doc.slug}`}
                      onClick={() => void copy(hostedDocUrl(doc.slug))}
                    >
                      Copy link
                    </Button>
                    <MoreMenu
                      size="small"
                      subject={doc.slug}
                      busy={remove.isPending && remove.variables === doc.id}
                      items={[
                        {
                          label: "Edit notes…",
                          onSelect: () => setEditingNotes(doc),
                        },
                        {
                          label: "Replace file…",
                          onSelect: () => setReplacing(doc),
                        },
                        {
                          label: "Delete",
                          destructive: true,
                          onSelect: () => void deleteDoc(doc),
                        },
                      ]}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
      {editingNotes && (
        <EditHostedDocNotesDialog
          doc={editingNotes}
          onClose={() => setEditingNotes(null)}
        />
      )}
      {replacing && (
        <ReplaceHostedDocFileDialog
          doc={replacing}
          onClose={() => setReplacing(null)}
        />
      )}
    </>
  );
}
