import { KORA_UPLOAD_NEEDS_TRANSCRIPTS } from "@alliance/common/kora";
import type { KoraBatchDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { Play, Shuffle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  browserTimeZone,
  closingInstant,
  dateInputValue,
  formatKoraDate,
} from "../lib/koraParticipants";
import {
  koraUploadRejection,
  useKoraBatchesAdmin,
  useUploadKoraBatch,
} from "../lib/useKoraBatchesAdmin";
import { useKoraBatchActions } from "./KoraBatchActions";
import { KoraBatchClosesAt } from "./KoraBatchClosesAt";
import { KoraBatchEvents } from "./KoraBatchEvents";

const CELL = "px-3 py-2 align-top";
const FIELD = "mt-1 block rounded border border-zinc-300 bg-white px-2 py-1";
const FILE_FIELD =
  "mt-1 block file:mr-2 file:cursor-pointer file:rounded file:border file:border-zinc-300 file:bg-white file:px-2 file:py-1 file:text-sm hover:file:bg-zinc-50";

function PreviewLink({ batchId }: { batchId: string }) {
  return (
    <Link
      to={`/kora-participants/preview/${batchId}`}
      aria-label="Preview a random transcript"
      title="Preview a random transcript"
      className="inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 text-zinc-700 hover:bg-zinc-50"
    >
      <Play className="h-4 w-4" aria-hidden="true" />
      <Shuffle className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function UploadError({ error }: { error: Error }) {
  const rejection = koraUploadRejection(error);
  return (
    <div role="alert" className="space-y-1 text-red-700">
      <p>
        {rejection?.message ??
          adminRefusalMessage(error, "Couldn't upload. Try again.")}
      </p>
      {rejection && (
        <ul className="list-disc pl-5">
          {rejection.rejected.map(({ line, problems }) => (
            <li key={line}>
              Line {line}: {problems.join("; ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadForm() {
  const [uploaded, setUploaded] = useState<KoraBatchDto | null>(null);
  const [transcripts, setTranscripts] = useState<File | null>(null);
  const [missingFile, setMissingFile] = useState(false);
  const upload = useUploadKoraBatch({ onSuccess: setUploaded });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMissingFile(!transcripts);
    if (!transcripts) return;
    const form = new FormData(event.currentTarget);
    setUploaded(null);
    upload.mutate({
      transcripts,
      transcriptsPerAssignment: Number(form.get("transcriptsPerAssignment")),
      reviewsPerTranscript: Number(form.get("reviewsPerTranscript")),
      closesAt: closingInstant(String(form.get("closesAt"))),
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-4">
        <label>
          Transcripts file from KORA (.jsonl, .json or .yaml)
          <input
            name="transcripts"
            type="file"
            onChange={(e) => setTranscripts(e.target.files?.[0] ?? null)}
            accept=".jsonl,.json,.yaml,.yml,application/json,application/yaml"
            className={FILE_FIELD}
          />
        </label>
        <label>
          Transcripts per assignment
          <input
            name="transcriptsPerAssignment"
            type="number"
            min={1}
            max={100}
            defaultValue={10}
            required
            className={FIELD}
          />
        </label>
        <label>
          Reviews per transcript
          <input
            name="reviewsPerTranscript"
            type="number"
            min={1}
            max={50}
            defaultValue={3}
            required
            className={FIELD}
          />
        </label>
        <label>
          Closes on
          <input
            name="closesAt"
            type="date"
            min={dateInputValue(new Date())}
            required
            aria-describedby="kora-closes-at-note"
            className={FIELD}
          />
          <span
            id="kora-closes-at-note"
            className="mt-1 block text-xs text-zinc-500"
          >
            At 23:59 your time ({browserTimeZone()})
          </span>
        </label>
      </div>
      <Button
        type="submit"
        color={ButtonColor.Black}
        size="small"
        disabled={upload.isPending}
      >
        {upload.isPending ? "Uploading…" : "Upload"}
      </Button>
      <div aria-live="polite">
        {uploaded && (
          <p>
            Read {uploaded.transcriptCount} transcripts.{" "}
            <PreviewLink batchId={uploaded.id} />
          </p>
        )}
      </div>
      {missingFile && (
        <p role="alert" className="text-red-700">
          {KORA_UPLOAD_NEEDS_TRANSCRIPTS}
        </p>
      )}
      {upload.isError && <UploadError error={upload.error} />}
    </form>
  );
}

function BatchList() {
  const batches = useKoraBatchesAdmin();
  if (batches.isPending) return <p className="text-sm">Loading batches…</p>;
  if (batches.isError) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {adminRefusalMessage(
          batches.error,
          "Couldn't load the batches. Reload to try again.",
        )}
      </p>
    );
  }
  if (batches.data.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        No transcripts yet. Upload KORA&apos;s file to make the project active.
      </p>
    );
  }
  return <BatchTable batches={batches.data} />;
}

function BatchTable({ batches }: { batches: KoraBatchDto[] }) {
  const actions = useKoraBatchActions(batches);
  return (
    <>
      <table className="text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className={CELL}>Uploaded</th>
            <th className={CELL}>Transcripts</th>
            <th className={CELL}>Per assignment</th>
            <th className={CELL}>Reviews each</th>
            <th className={CELL}>Closes on</th>
            <th className={CELL}>Status</th>
            <th className={CELL}>
              <span className="sr-only">Preview</span>
            </th>
            <th className={CELL}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => (
            <tr key={batch.id} className="border-t border-zinc-200">
              <td className={CELL}>{formatKoraDate(batch.createdAt)}</td>
              <td className={CELL}>{batch.transcriptCount}</td>
              <td className={CELL}>{batch.transcriptsPerAssignment}</td>
              <td className={CELL}>{batch.reviewsPerTranscript}</td>
              <td className={CELL}>
                <KoraBatchClosesAt batch={batch} />
              </td>
              <td className={CELL}>
                {batch.retiredAt
                  ? `Retired ${formatKoraDate(batch.retiredAt)}`
                  : "Assigning"}
              </td>
              <td className={CELL}>
                <PreviewLink batchId={batch.id} />
              </td>
              <td className={CELL}>{actions.actionsFor(batch)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {actions.dialog}
    </>
  );
}

export function KoraBatches() {
  return (
    <section aria-labelledby="kora-batches" className="space-y-3">
      <h2 id="kora-batches" className="font-semibold">
        Transcripts
      </h2>
      <BatchList />
      <UploadForm />
      <KoraBatchEvents />
    </section>
  );
}
