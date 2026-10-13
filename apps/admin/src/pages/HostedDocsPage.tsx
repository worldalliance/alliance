import {
  HOSTED_DOC_MAX_BYTES,
  hostedDocFieldsSchema,
  hostedDocNotesSchema,
  hostedDocSlugFromFileName,
  hostedDocUrl,
} from "@alliance/common/hostedDocs";
import type { HostedDocDto } from "@alliance/shared/client";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { copyToClipboard } from "@alliance/sharedweb/lib/clipboard";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { Copy, FileUp } from "lucide-react";
import React, { useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import InlineTextInput from "../components/InlineTextInput";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  useCreateHostedDocAdmin,
  useDeleteHostedDocAdmin,
  useHostedDocsAdmin,
  useReplaceHostedDocFileAdmin,
  useUpdateHostedDocAdmin,
} from "../lib/useHostedDocsAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";

const INITIAL_DRAFT = { slug: "", notes: "" };
const INPUT_CLASS = "border border-zinc-300 rounded px-2 py-1 mt-1";
const INLINE_CLASS =
  "w-full border border-transparent hover:border-zinc-300 focus:border-zinc-400 rounded px-1 py-0.5";

function pdfProblem(file: File): string | null {
  if (file.type !== "application/pdf") return "Choose a PDF file.";
  if (file.size > HOSTED_DOC_MAX_BYTES) return "PDFs can be at most 50 MB.";
  return null;
}

const byline = (name: string | null, at: string) =>
  `${name ?? "Deleted admin"} · ${formatDateTime(new Date(at))}`;

const HostedDocsPage: React.FC = () => {
  const docs = useHostedDocsAdmin();
  const refusalToast = useRefusalToast();
  const { success, error: toastError } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<{
    doc: HostedDocDto;
    file: File;
  } | null>(null);
  const [deleting, setDeleting] = useState<HostedDocDto | null>(null);
  const create = useCreateHostedDocAdmin({
    onSuccess: () => {
      setDraft(INITIAL_DRAFT);
      setFile(null);
      setValidationError(null);
      if (fileInput.current) fileInput.current.value = "";
    },
    onError: (err) => refusalToast(err, "Could not upload the document."),
  });
  const replace = useReplaceHostedDocFileAdmin({
    onSuccess: () => setReplacing(null),
    onError: (err) => refusalToast(err, "Could not replace the file."),
  });
  const update = useUpdateHostedDocAdmin({
    onError: (err) => refusalToast(err, "Could not update the notes."),
  });
  const remove = useDeleteHostedDocAdmin({
    onSuccess: () => setDeleting(null),
    onError: (err) => refusalToast(err, "Could not delete the document."),
  });

  const copy = async (slug: string) => {
    if (await copyToClipboard(hostedDocUrl(slug))) success("Link copied.");
    else toastError("Could not copy the link.");
  };

  const pickReplacement = (doc: HostedDocDto, picked: File | undefined) => {
    if (!picked) return;
    const problem = pdfProblem(picked);
    if (problem) toastError(problem);
    else setReplacing({ doc, file: picked });
  };

  return (
    <div className="p-5 space-y-4">
      <title>Hosted Docs - Admin</title>
      <div>
        <h1 className="text-lg font-bold text-zinc-900">Hosted docs</h1>
        <p className="text-sm text-zinc-600 mt-1 max-w-3xl">
          PDFs served publicly at thealliance.org/docs/&lt;ID&gt;. Anyone with
          the link can open them, and search engines may index them.
        </p>
      </div>
      <form
        className="flex flex-wrap gap-3 items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = hostedDocFieldsSchema.safeParse(draft);
          const problem = !file
            ? "Choose a PDF file."
            : parsed.success
              ? pdfProblem(file)
              : parsed.error.issues[0].message;
          setValidationError(problem);
          if (problem || !file || !parsed.success) return;
          create.mutate({ ...parsed.data, file });
        }}
      >
        <label className="flex flex-col text-sm text-zinc-700">
          PDF
          <input
            ref={fileInput}
            className="mt-1 text-sm"
            type="file"
            accept="application/pdf"
            disabled={create.isPending}
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              setFile(picked);
              if (picked)
                setDraft({
                  ...draft,
                  slug: hostedDocSlugFromFileName(picked.name),
                });
            }}
          />
        </label>
        <label className="flex flex-col text-sm text-zinc-700 min-w-72">
          ID
          <input
            className={INPUT_CLASS}
            value={draft.slug}
            maxLength={104}
            required
            readOnly={create.isPending}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            placeholder="2026-DemocraticGrantMakingPilot.pdf"
          />
        </label>
        <label className="flex flex-col text-sm text-zinc-700 flex-1 min-w-64">
          Notes
          <input
            className={INPUT_CLASS}
            value={draft.notes}
            maxLength={2000}
            readOnly={create.isPending}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder="Visible to admins only"
          />
        </label>
        <Button
          type="submit"
          size="small"
          color={ButtonColor.Black}
          disabled={create.isPending}
        >
          Upload
        </Button>
      </form>
      {validationError && (
        <p role="alert" className="text-sm text-red-600">
          {validationError}
        </p>
      )}
      <p className="text-xs text-zinc-500">
        The ID cannot be changed later. Views count every opening, including
        repeat visits and automated requests.
      </p>
      {docs.isPending ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : docs.error ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-red-600">
            {adminRefusalMessage(docs.error, "Unable to load hosted docs.")}
          </p>
          <Button size="small" onClick={() => void docs.refetch()}>
            Retry
          </Button>
        </div>
      ) : docs.data?.length === 0 ? (
        <p className="text-sm text-zinc-500">No hosted docs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-zinc-200">
            <thead className="bg-zinc-50 text-left">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Views</th>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2">File replaced</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {docs.data?.map((doc) => (
                <tr key={doc.id} className="border-t border-zinc-200">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <a
                        href={hostedDocUrl(doc.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {doc.slug}
                      </a>
                      <button
                        type="button"
                        aria-label={`Copy link to ${doc.slug}`}
                        title="Copy link"
                        onClick={() => void copy(doc.slug)}
                        className="text-zinc-500 hover:text-black"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 min-w-64">
                    <InlineTextInput
                      aria-label={`Notes for ${doc.slug}`}
                      className={INLINE_CLASS}
                      value={doc.notes}
                      maxLength={2000}
                      disabled={update.isPending}
                      onSave={(notes, done) => {
                        const parsed = hostedDocNotesSchema.safeParse(notes);
                        if (!parsed.success) {
                          toastError(parsed.error.issues[0].message);
                          return;
                        }
                        update.mutate(
                          { id: doc.id, body: { notes: parsed.data } },
                          { onSuccess: done },
                        );
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 tabular-nums">{doc.views}</td>
                  <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                    {byline(doc.uploadedByName, doc.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                    {doc.fileReplacedAt
                      ? byline(doc.fileReplacedByName, doc.fileReplacedAt)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <label
                      title="Replace file"
                      className="inline-flex align-middle mr-2 text-zinc-500 hover:text-black cursor-pointer"
                    >
                      <FileUp size={16} />
                      <input
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        aria-label={`Replace file for ${doc.slug}`}
                        disabled={replace.isPending}
                        onChange={(e) => {
                          pickReplacement(doc, e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <Button
                      color={ButtonColor.Transparent}
                      size="small"
                      disabled={remove.isPending}
                      onClick={() => setDeleting(doc)}
                    >
                      Delete document
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        isOpen={replacing !== null}
        title="Replace this file?"
        message={`/docs/${replacing?.doc.slug} will serve ${replacing?.file.name} within five minutes. The current file will be deleted. This cannot be undone.`}
        confirmLabel="Replace file"
        onConfirm={() =>
          replacing &&
          replace.mutate({ id: replacing.doc.id, file: replacing.file })
        }
        onCancel={() => setReplacing(null)}
        isLoading={replace.isPending}
      />
      <ConfirmDialog
        isOpen={deleting !== null}
        title="Delete this document?"
        message={`/docs/${deleting?.slug} will stop working, and a new document can take its ID.`}
        confirmLabel="Delete document"
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
        isLoading={remove.isPending}
      />
    </div>
  );
};

export default HostedDocsPage;
