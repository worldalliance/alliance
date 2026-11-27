import { KORA_UPLOAD_NEEDS_TRANSCRIPTS } from "@alliance/common/kora";
import type { KoraBatchDto } from "@alliance/shared/client";
import { type Ref, useImperativeHandle, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { closingInstant, dateInputValue } from "../../lib/koraParticipants";
import {
  koraUploadRejection,
  useUploadKoraBatch,
} from "../../lib/useKoraBatchesAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { DateField } from "../../ui/DateField";
import { FileInput } from "../../ui/FileInput";
import { Input } from "../../ui/Input";
import { Field, useFocusFirstInvalid } from "../../ui/templates/Form";
import { Panel } from "../../ui/templates/Overview";
import {
  type BatchSettings,
  type BatchSettingsErrors,
  validateBatchSettings,
} from "./batchRules";
import { CLOSES_ON_HELP } from "./ChangeClosingDateDialog";
import { PreviewLink } from "./PreviewLink";

const DEFAULTS: BatchSettings = {
  transcriptsPerAssignment: "10",
  reviewsPerTranscript: "5",
  closesOn: "",
};

function UploadError({ error }: { error: Error }) {
  const rejection = koraUploadRejection(error);
  return (
    <div role="alert" className="flex flex-col gap-1 text-danger">
      <p>
        {rejection?.message ??
          adminRefusalMessage(error, "Couldn't upload the transcripts.")}
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

export function UploadBatchPanel({
  ref,
}: {
  ref?: Ref<{ focus: () => void }>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [values, setValues] = useState(DEFAULTS);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<BatchSettingsErrors>({});
  const [uploaded, setUploaded] = useState<KoraBatchDto | null>(null);
  const { formRef, focusFirstInvalid } = useFocusFirstInvalid();
  useImperativeHandle(ref, () => ({
    focus: () => formRef.current?.querySelector("input")?.focus(),
  }));
  const upload = useUploadKoraBatch({
    onSuccess: (batch) => {
      setUploaded(batch);
      setFiles([]);
    },
  });

  const set = (key: keyof BatchSettings) => (value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const [transcripts] = files;
    const validated = validateBatchSettings(values);
    setFileError(transcripts ? null : KORA_UPLOAD_NEEDS_TRANSCRIPTS);
    setErrors(validated.ok ? {} : validated.error);
    if (!transcripts || !validated.ok) {
      focusFirstInvalid();
      return;
    }
    setUploaded(null);
    upload.mutate({
      transcripts,
      transcriptsPerAssignment: validated.value.transcriptsPerAssignment,
      reviewsPerTranscript: validated.value.reviewsPerTranscript,
      closesAt: closingInstant(validated.value.closesOn),
    });
  };

  return (
    <Panel title="Upload a batch">
      <form
        ref={formRef}
        onSubmit={submit}
        noValidate
        className="flex flex-col gap-4"
      >
        <Field
          label="Transcripts file from KORA"
          help="A .jsonl, .json or .yaml file. Nothing is saved if any line is rejected."
          error={fileError}
        >
          {(control) => (
            <FileInput
              {...control}
              value={files}
              onChange={(next) => {
                setFiles(next);
                setFileError(null);
              }}
              accept=".jsonl,.json,.yaml,.yml,application/json,application/yaml"
            />
          )}
        </Field>
        <div className="flex flex-wrap items-start gap-4">
          <Field
            label="Transcripts per assignment"
            help="1 to 100"
            error={errors.transcriptsPerAssignment}
            className="w-52"
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={values.transcriptsPerAssignment}
                onChange={(e) =>
                  set("transcriptsPerAssignment")(e.target.value)
                }
                className="tabular-nums"
              />
            )}
          </Field>
          <Field
            label="Reviews per transcript"
            help="1 to 50"
            error={errors.reviewsPerTranscript}
            className="w-52"
          >
            {(control) => (
              <Input
                {...control}
                type="number"
                inputMode="numeric"
                min={1}
                max={50}
                value={values.reviewsPerTranscript}
                onChange={(e) => set("reviewsPerTranscript")(e.target.value)}
                className="tabular-nums"
              />
            )}
          </Field>
        </div>
        <Field
          label="Closes on"
          help={CLOSES_ON_HELP}
          error={errors.closesOn}
          className="max-w-prose"
        >
          {(control) => (
            <DateField
              {...control}
              value={values.closesOn}
              min={dateInputValue(new Date())}
              onChange={set("closesOn")}
              className="w-52"
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant={ButtonVariant.Primary}
            busy={upload.isPending}
          >
            Upload
          </Button>
          <div aria-live="polite" className="flex items-center gap-3">
            {uploaded && (
              <>
                <span>
                  Read {countOf(uploaded.transcriptCount, "transcript")}.
                </span>
                <PreviewLink batchId={uploaded.id} />
              </>
            )}
          </div>
        </div>
        {upload.isError && <UploadError error={upload.error} />}
      </form>
    </Panel>
  );
}
